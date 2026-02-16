import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/buttons";
import { Hand } from "@/components/game/Hand";
import { Trick } from "@/components/game/Trick";
import { PageLayout, ButtonGroup } from "@/components/ui";
import {
   advanceGame,
   getGameState,
   submitPass,
   submitPlay,
} from "@/lib/game-api";
import type {
   CurrentTrickSlot,
   GameState,
   PlayEvent,
   PlayResponse,
} from "@/types/game";
import styles from "@/styles/play.module.css";

const AI_PLAY_DELAY_MS = 1000;
const ROUND_END_DELAY_MS = 3000;
/** Pause between tricks so "Hand Resolves" is visible before next trick. */
const TRICK_CLEAR_MS = 500;
/** After the user's card appears, hold it visible before showing the next player's card. */
const USER_PLAY_HOLD_MS = 800;

/** PageLayout body classes without top margin (mt-10) for play page layout */
const PLAY_PAGE_LAYOUT_CLASS =
   "w-[85vw] flex flex-col items-center justify-center text-center";

/** Build trick slots by player: slot 0 = player 0 (You/bottom), 1 = AI1/left, 2 = AI2/top, 3 = AI3/right. So each card appears in the correct player's position. */
function buildSlotsFromPlays(plays: PlayEvent[]): CurrentTrickSlot[] {
   const slots: CurrentTrickSlot[] = [null, null, null, null];
   for (const p of plays) {
      if (p.player_index >= 0 && p.player_index < 4)
         slots[p.player_index] = { player_index: p.player_index, card: p.card };
   }
   return slots;
}

/** Reorder trick slots for table layout: API order 0,1,2,3 → display order bottom(0), top(2), left(1), right(3) so turn order is clockwise left (user→AI1→AI2→AI3). */
function reorderSlotsForTableLayout<T>(arr: T[]): T[] {
   if (arr.length < 4) return arr;
   return [arr[0], arr[2], arr[1], arr[3]];
}

/**
 * Play page flows (for maintenance):
 *
 * 1) Initial load (useEffect[gameId]): getGameState → if playing && whose_turn !== 0, advanceGame
 *    then runPlayResponseAnimation. Else setState(data), setLoading(false). Advance always ends with
 *    whose_turn === 0 or error.
 *
 * 2) After pass (handleSubmitPass): submitPass → setState; if playing && whose_turn !== 0, advanceGame
 *    then runPlayResponseAnimation. submitting stays true until animation clears.
 *
 * 3) User plays (handlePlayCard): isSubmittingPlayRef blocks re-entry. submitPlay → runPlayResponseAnimation.
 *    Ref cleared only when animation finishes or on error.
 *
 * 4) When it's AI's turn (useEffect[state.whose_turn, submitting, ...]): if !submitting && whose_turn !== 0,
 *    advanceGame → runPlayResponseAnimation. submitting set true so effect won't re-run until animation clears.
 *
 * 5) runPlayResponseAnimation: setState(data), chunk intermediate_plays into tricks of 4, animate each trick
 *    (1 card per second), clear between tricks (TRICK_CLEAR_MS), then final clear + setSubmitting(false) + ref false.
 */
export default function PlayGamePage() {
   const router = useRouter();
   const { game_id: gameId } = router.query;
   const [loading, setLoading] = useState(true);
   const [notFound, setNotFound] = useState(false);
   const [state, setState] = useState<GameState | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [passSelection, setPassSelection] = useState<Set<string>>(new Set());
   const [displayTrickSlots, setDisplayTrickSlots] = useState<
      CurrentTrickSlot[] | null
   >(null);
   const animationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
   /** Block duplicate or stray card plays: set synchronously so double-clicks / animation-time clicks are ignored. */
   const isSubmittingPlayRef = useRef(false);

   useEffect(() => {
      return () => {
         animationTimeoutsRef.current.forEach(clearTimeout);
         animationTimeoutsRef.current = [];
      };
   }, []);

   const runPlayResponseAnimation = useCallback((data: PlayResponse) => {
      const plays = data.intermediate_plays ?? [];
      console.log("[HEARTS] runPlayResponseAnimation called", {
         source: new Error().stack?.split("\n")[2]?.trim(),
         round_just_ended: data.round_just_ended,
         intermediate_plays_count: plays.length,
         intermediate_plays: plays,
         whose_turn: data.whose_turn,
         current_trick_length: data.current_trick?.length ?? 0,
         current_trick: data.current_trick,
      });
      // Cancel any previous animation so we don't get overlapping timeouts or stale clears
      animationTimeoutsRef.current.forEach(clearTimeout);
      animationTimeoutsRef.current = [];
      setState(data);
      if (plays.length === 0) {
         console.log(
            "[HEARTS] runPlayResponseAnimation: no plays, clearing displayTrickSlots and setting submitting=false"
         );
         setDisplayTrickSlots(null);
         if (data.round_just_ended) {
            setState((prev) =>
               prev && (prev.current_trick?.length ?? 0) > 0
                  ? { ...prev, current_trick: [] }
                  : prev
            );
         }
         setSubmitting(false);
         isSubmittingPlayRef.current = false;
         return;
      }
      // Chunk by trick (4 plays = one trick). Animate one trick at a time, then clear, then next trick.
      const tricks: PlayEvent[][] = [];
      for (let i = 0; i < plays.length; i += 4) {
         tricks.push(plays.slice(i, Math.min(i + 4, plays.length)));
      }
      const roundEndExtra = data.round_just_ended ? ROUND_END_DELAY_MS : 0;
      let timeMs = 0;
      for (let k = 0; k < tricks.length; k++) {
         const trick = tricks[k];
         const isLastTrick = k === tricks.length - 1;
         // For the last (partial) trick only: use response current_trick so the full partial trick
         // (e.g. AI3 + user) stays visible. Don't use it for earlier chunks — current_trick is
         // the state after all plays, so it only matches the last partial trick.
         // For last incomplete chunk: current_trick has existing lead cards + chunk. Show existing
         // plus slice so we animate one card at a time and the lead (e.g. AI3) never disappears.
         const currentTrickFiltered = (data.current_trick?.filter(Boolean) ?? []) as PlayEvent[];
         const useCurrentTrickPrefix =
            isLastTrick &&
            trick.length < 4 &&
            currentTrickFiltered.length >= trick.length;
         const existingCount = useCurrentTrickPrefix
            ? currentTrickFiltered.length - trick.length
            : 0;
         const existingPlays = useCurrentTrickPrefix
            ? currentTrickFiltered.slice(0, existingCount)
            : [];
         const firstCardIsUser = trick.length > 0 && trick[0].player_index === 0;
         for (let j = 0; j < trick.length; j++) {
            const holdAfterFirst = firstCardIsUser && j >= 1 ? USER_PLAY_HOLD_MS : 0;
            const ms = timeMs + holdAfterFirst + j * AI_PLAY_DELAY_MS;
            const slice = trick.slice(0, j + 1);
            const t = setTimeout(() => {
               const toShow = existingPlays.concat(slice);
               setDisplayTrickSlots(buildSlotsFromPlays(toShow));
            }, ms);
            animationTimeoutsRef.current.push(t);
         }
         timeMs += (firstCardIsUser && trick.length >= 1 ? USER_PLAY_HOLD_MS : 0) + trick.length * AI_PLAY_DELAY_MS;
         // Pause between tricks but don't clear the table — next trick's first frame overwrites.
         if (!isLastTrick) timeMs += TRICK_CLEAR_MS;
      }
      const clearAt = timeMs + roundEndExtra;
      // Only clear current_trick in state when the trick we just animated was complete (4 plays) or round ended.
      // Otherwise we'd wipe a mid-trick state (e.g. AI led 2♣, 1 card in trick) and the table would show empty.
      const lastTrickComplete =
         tricks.length > 0 &&
         (data.round_just_ended || tricks[tricks.length - 1].length === 4);
      console.log("[HEARTS] runPlayResponseAnimation: scheduling", {
         plays_count: plays.length,
         tricks_count: tricks.length,
         lastTrickComplete,
         clearAt_ms: clearAt,
      });
      const t = setTimeout(() => {
         const shouldClearTrick =
            data.round_just_ended ||
            (lastTrickComplete && (data.current_trick?.length ?? 0) > 0);
         if (shouldClearTrick) {
            setDisplayTrickSlots([null, null, null, null]);
            setState((prev) => (prev ? { ...prev, current_trick: [] } : prev));
         } else {
            const partial = (data.current_trick?.filter(Boolean) ?? []) as PlayEvent[];
            setDisplayTrickSlots(
               partial.length > 0 ? buildSlotsFromPlays(partial) : [null, null, null, null]
            );
         }
         setSubmitting(false);
         isSubmittingPlayRef.current = false;
      }, clearAt);
      animationTimeoutsRef.current.push(t);
   }, []);

   useEffect(() => {
      if (typeof gameId !== "string" || !gameId) {
         setLoading(false);
         return;
      }
      let cancelled = false;
      setLoading(true);
      setNotFound(false);
      setError(null);
      console.log("[HEARTS] initial load: getGameState", gameId);
      getGameState(gameId)
         .then((result) => {
            if (cancelled) return;
            console.log("[HEARTS] getGameState result", {
               ok: result.ok,
               phase: result.ok ? result.data.phase : undefined,
               whose_turn: result.ok ? result.data.whose_turn : undefined,
               current_trick_len: result.ok
                  ? result.data.current_trick?.length
                  : undefined,
            });
            if (!result.ok) {
               if (result.notFound) setNotFound(true);
               else setError(result.error);
               setLoading(false);
               return;
            }
            const data = result.data;
            if (data.phase === "playing" && data.whose_turn !== 0) {
               console.log(
                  "[HEARTS] initial load: whose_turn !== 0, calling advanceGame",
                  {
                     whose_turn: data.whose_turn,
                  }
               );
               advanceGame(gameId)
                  .then((advResult) => {
                     if (cancelled) return;
                     if (!advResult.ok) {
                        setError(advResult.error);
                        setLoading(false);
                        return;
                     }
                     console.log(
                        "[HEARTS] advanceGame (initial) success, runPlayResponseAnimation",
                        {
                           intermediate_plays:
                              advResult.data.intermediate_plays?.length,
                           round_just_ended: advResult.data.round_just_ended,
                        }
                     );
                     setLoading(false);
                     setSubmitting(true);
                     runPlayResponseAnimation(advResult.data);
                  })
                  .catch((e) => {
                     if (cancelled) return;
                     setError(
                        e instanceof Error
                           ? e.message
                           : "Failed to advance game"
                     );
                     setLoading(false);
                  });
            } else {
               console.log(
                  "[HEARTS] initial load: setting state directly (no advance)",
                  {
                     phase: data.phase,
                     whose_turn: data.whose_turn,
                  }
               );
               setState(data);
               setLoading(false);
            }
         })
         .catch((e) => {
            if (cancelled) return;
            setError(e instanceof Error ? e.message : "Failed to load game");
            setLoading(false);
         });
      return () => {
         console.log(
            "[HEARTS] initial load useEffect cleanup (cancelled=true)",
            gameId
         );
         cancelled = true;
      };
   }, [gameId, runPlayResponseAnimation]);

   // When it's the AI's turn (e.g. AI won the trick and leads next), advance the game and animate their plays.
   useEffect(() => {
      if (
         typeof gameId !== "string" ||
         !gameId ||
         !state ||
         state.phase !== "playing" ||
         state.game_over ||
         state.whose_turn === 0 ||
         loading ||
         submitting
      ) {
         return;
      }
      let cancelled = false;
      console.log("[HEARTS] useEffect: whose_turn !== 0, calling advanceGame", {
         whose_turn: state.whose_turn,
      });
      setSubmitting(true);
      advanceGame(gameId)
         .then((advResult) => {
            if (cancelled) return;
            if (!advResult.ok) {
               setError(advResult.error);
               setSubmitting(false);
               isSubmittingPlayRef.current = false;
               return;
            }
            console.log(
               "[HEARTS] advanceGame (post-play) success, runPlayResponseAnimation",
               {
                  intermediate_plays: advResult.data.intermediate_plays?.length,
                  round_just_ended: advResult.data.round_just_ended,
               }
            );
            runPlayResponseAnimation(advResult.data);
         })
         .catch((e) => {
            if (cancelled) return;
            setError(e instanceof Error ? e.message : "Failed to advance game");
            setSubmitting(false);
            isSubmittingPlayRef.current = false;
         });
      return () => {
         cancelled = true;
      };
   }, [
      gameId,
      state?.phase,
      state?.whose_turn,
      state?.game_over,
      loading,
      submitting,
      runPlayResponseAnimation,
   ]);

   const handlePassCardToggle = useCallback((code: string) => {
      setPassSelection((prev) => {
         const next = new Set(prev);
         if (next.has(code)) next.delete(code);
         else if (next.size < 3) next.add(code);
         return next;
      });
   }, []);

   const handleSubmitPass = useCallback(() => {
      if (typeof gameId !== "string" || passSelection.size !== 3) return;
      setSubmitting(true);
      const cards = Array.from(passSelection) as [string, string, string];
      submitPass(gameId, { cards })
         .then((result) => {
            if (!result.ok) {
               setError(result.error);
               setSubmitting(false);
               return;
            }
            setState(result.data);
            setPassSelection(new Set());
            if (
               result.data.phase === "playing" &&
               result.data.whose_turn !== 0
            ) {
               console.log(
                  "[HEARTS] handleSubmitPass: after pass, whose_turn !== 0, calling advanceGame"
               );
               advanceGame(gameId)
                  .then((advResult) => {
                     if (!advResult.ok) {
                        setError(advResult.error);
                        setSubmitting(false);
                        return;
                     }
                     console.log(
                        "[HEARTS] handleSubmitPass advanceGame success, runPlayResponseAnimation"
                     );
                     runPlayResponseAnimation(advResult.data);
                  })
                  .catch((e) => {
                     setError(
                        e instanceof Error ? e.message : "Advance failed"
                     );
                     setSubmitting(false);
                  });
            } else {
               setSubmitting(false);
            }
         })
         .catch((e) => {
            setError(e instanceof Error ? e.message : "Submit failed");
            setSubmitting(false);
         });
   }, [gameId, passSelection, runPlayResponseAnimation]);

   const handlePlayCard = useCallback(
      (code: string) => {
         if (typeof gameId !== "string") return;
         if (isSubmittingPlayRef.current) return;
         isSubmittingPlayRef.current = true;
         console.log("[HEARTS] handlePlayCard", { card: code });
         setSubmitting(true);
         submitPlay(gameId, { card: code })
            .then((result) => {
               console.log("[HEARTS] submitPlay result", {
                  ok: result.ok,
                  intermediate_plays: result.ok
                     ? result.data.intermediate_plays?.length
                     : undefined,
                  round_just_ended: result.ok
                     ? result.data.round_just_ended
                     : undefined,
                  whose_turn: result.ok ? result.data.whose_turn : undefined,
               });
               if (!result.ok) {
                  setError(result.error);
                  setSubmitting(false);
                  isSubmittingPlayRef.current = false;
                  return;
               }
               runPlayResponseAnimation(result.data);
            })
            .catch((e) => {
               console.log("[HEARTS] submitPlay catch", e);
               setError(e instanceof Error ? e.message : "Play failed");
               setSubmitting(false);
               isSubmittingPlayRef.current = false;
            });
      },
      [gameId, runPlayResponseAnimation]
   );

   if (typeof gameId !== "string" || !gameId) {
      return (
         <>
            <Head>
               <title>Play Game | Hearts</title>
               <link rel="icon" href="/images/favicon.ico" />
            </Head>
            <PageLayout
               title="PLAY GAME"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <p>No game specified.</p>
               <ButtonGroup className="pt-4">
                  <Link href="/game/create">
                     <Button name="Create Game" style={{ width: "250px" }} />
                  </Link>
                  <Link href="/">
                     <Button name="Home" style={{ width: "250px" }} />
                  </Link>
               </ButtonGroup>
            </PageLayout>
         </>
      );
   }

   if (loading) {
      return (
         <>
            <Head>
               <title>Play Game | Hearts</title>
               <link rel="icon" href="/images/favicon.ico" />
            </Head>
            <PageLayout
               title="PLAY GAME"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <div className="animate-pulse flex flex-col gap-4 w-full max-w-md">
                  <div className="h-8 bg-gray-200 rounded w-1/3" />
                  <div className="h-24 bg-gray-200 rounded" />
                  <div className="h-32 bg-gray-200 rounded" />
               </div>
            </PageLayout>
         </>
      );
   }

   if (notFound) {
      return (
         <>
            <Head>
               <title>Game Not Found | Hearts</title>
               <link rel="icon" href="/images/favicon.ico" />
            </Head>
            <PageLayout
               title="PLAY GAME"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <p>Game not found.</p>
               <ButtonGroup className="pt-4">
                  <Link href="/game/create">
                     <Button name="Create Game" style={{ width: "200px" }} />
                  </Link>
                  <Link href="/">
                     <Button name="Home" style={{ width: "200px" }} />
                  </Link>
               </ButtonGroup>
            </PageLayout>
         </>
      );
   }

   if (error) {
      return (
         <>
            <Head>
               <title>Play Game | Hearts</title>
               <link rel="icon" href="/images/favicon.ico" />
            </Head>
            <PageLayout
               title="PLAY GAME"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <p className="text-red-600" role="alert">
                  {error}
               </p>
               <ButtonGroup className="pt-4">
                  <Link href="/game/create">
                     <Button
                        name="Create New Game"
                        style={{ width: "250px" }}
                     />
                  </Link>
                  <Link href="/">
                     <Button name="Home" style={{ width: "250px" }} />
                  </Link>
               </ButtonGroup>
            </PageLayout>
         </>
      );
   }

   return (
      <>
         <Head>
            <title>Play Game | Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
         </Head>
         <PageLayout
            title="PLAY GAME"
            hideTitleBlock
            className={PLAY_PAGE_LAYOUT_CLASS}
         >
            {state && (
               <div className={styles.playContent}>
                  <header className={styles.playHeader}>
                     <span>
                        Round {state.round}
                        {state.pass_direction !== "none" && (
                           <> · Pass {state.pass_direction}</>
                        )}
                     </span>
                     <span className={styles.playPhase}>{state.phase}</span>
                  </header>

                  <div className={styles.gameTable}>
                     {/* Top (player 2 – second AI, clockwise left from user) */}
                     <div
                        className={`${styles.gameTableSeat} ${
                           styles.gameTableSeatTop
                        } ${
                           state.phase === "playing" &&
                           !state.game_over &&
                           state.whose_turn === 2
                              ? styles.gameTableSeatYourTurn
                              : ""
                        }`}
                     >
                        <span className={styles.gameTableSeatName}>
                           {state.players[2]?.name ?? "—"}
                        </span>
                        <span className={styles.gameTableSeatScore}>
                           {state.players[2]?.score ?? 0}
                        </span>
                     </div>
                     {/* Left (player 1 – first AI, clockwise left from user) */}
                     <div
                        className={`${styles.gameTableSeat} ${
                           styles.gameTableSeatLeft
                        } ${
                           state.phase === "playing" &&
                           !state.game_over &&
                           state.whose_turn === 1
                              ? styles.gameTableSeatYourTurn
                              : ""
                        }`}
                     >
                        <span className={styles.gameTableSeatName}>
                           {state.players[1]?.name ?? "—"}
                        </span>
                        <span className={styles.gameTableSeatScore}>
                           {state.players[1]?.score ?? 0}
                        </span>
                     </div>
                     {/* Center: trick + hearts broken */}
                     <div className={styles.tableCenter}>
                        <Trick
                           layout="table"
                           slots={(() => {
                              if (state.phase === "passing")
                                 return [null, null, null, null];
                              const raw =
                                 displayTrickSlots ?? state.current_trick ?? [];
                              // By player: slot 0 = You/bottom, 1 = AI1/left, 2 = AI2/top, 3 = AI3/right (so each card shows in correct seat)
                              const padded: CurrentTrickSlot[] = [
                                 null,
                                 null,
                                 null,
                                 null,
                              ];
                              for (const s of raw)
                                 if (
                                    s &&
                                    typeof s.player_index === "number" &&
                                    s.player_index >= 0 &&
                                    s.player_index < 4
                                 )
                                    padded[s.player_index] = s;
                              return padded;
                           })()}
                           playerNames={reorderSlotsForTableLayout(
                              state.players.map((p) => p.name)
                           )}
                           centerIcon={
                              state.phase === "playing" ? (
                                 <span
                                    aria-hidden
                                    style={{
                                       fontSize: "50px",
                                       marginTop: "-10px",
                                       color: state.hearts_broken
                                          ? "hsl(0, 65%, 50%)"
                                          : "var(--darkpink)",
                                    }}
                                 >
                                    ♥
                                 </span>
                              ) : undefined
                           }
                        />
                     </div>
                     {/* Right (player 3) */}
                     <div
                        className={`${styles.gameTableSeat} ${
                           styles.gameTableSeatRight
                        } ${
                           state.phase === "playing" &&
                           !state.game_over &&
                           state.whose_turn === 3
                              ? styles.gameTableSeatYourTurn
                              : ""
                        }`}
                     >
                        <span className={styles.gameTableSeatName}>
                           {state.players[3]?.name ?? "—"}
                        </span>
                        <span className={styles.gameTableSeatScore}>
                           {state.players[3]?.score ?? 0}
                        </span>
                     </div>
                     {/* Bottom (player 0 = human) */}
                     <div
                        className={`${styles.gameTableSeat} ${
                           styles.gameTableSeatBottom
                        } ${
                           state.phase === "playing" &&
                           !state.game_over &&
                           state.whose_turn === 0
                              ? styles.gameTableSeatYourTurn
                              : ""
                        }`}
                     >
                        <span className={styles.gameTableSeatName}>
                           {state.players[0]?.name ?? "You"}
                        </span>
                        <span className={styles.gameTableSeatScore}>
                           {state.players[0]?.score ?? 0}
                        </span>
                     </div>
                  </div>

                  {state.phase === "playing" && (
                     <p className={styles.playTurnHint}>
                        {submitting
                           ? "Playing…"
                           : state.whose_turn === 0 && !state.game_over
                           ? "Your turn"
                           : "Waiting for others…"}
                     </p>
                  )}

                  {state.phase === "passing" && (
                     <>
                        <p className={styles.passHint}>
                           Select 3 cards to pass {state.pass_direction}.
                        </p>
                        <Hand
                           cards={state.human_hand}
                           selectedCodes={passSelection}
                           onCardClick={
                              submitting ? undefined : handlePassCardToggle
                           }
                           selectionMode
                        />
                        <div className={styles.passActions}>
                           <Button
                              name="Submit pass"
                              disabled={passSelection.size !== 3 || submitting}
                              onClick={handleSubmitPass}
                              style={{ width: "180px" }}
                           />
                        </div>
                     </>
                  )}

                  {state.phase === "playing" && (
                     <Hand
                        cards={state.human_hand}
                        legalCodes={new Set(state.legal_plays)}
                        onCardClick={
                           !submitting &&
                           state.whose_turn === 0 &&
                           !state.game_over
                              ? handlePlayCard
                              : undefined
                        }
                     />
                  )}

                  {state.game_over && (
                     <div className={styles.gameOverBlock}>
                        <p className={styles.gameOverMessage}>
                           Game over – Winner:{" "}
                           {state.winner_index != null &&
                           state.players[state.winner_index]
                              ? state.players[state.winner_index].name
                              : "—"}
                        </p>
                        <Link href="/game/create">
                           <Button
                              name="Create New Game"
                              style={{ width: "250px", marginTop: "12px" }}
                           />
                        </Link>
                     </div>
                  )}
               </div>
            )}
            {state?.game_over ? null : (
               <ButtonGroup className="pt-12">
                  <Link href="/game/create">
                     <Button
                        name="Create New Game"
                        style={{ width: "250px" }}
                     />
                  </Link>
                  <Link href="/">
                     <Button name="Home" style={{ width: "250px" }} />
                  </Link>
               </ButtonGroup>
            )}
         </PageLayout>
      </>
   );
}
