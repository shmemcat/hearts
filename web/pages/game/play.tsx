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

/** Interval for revealing plays one-by-one; only advances reveal.count, never mutates game state. */
const REVEAL_INTERVAL_MS = 1000;

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
 *    then applyPlayResponse. Else setState(data), setLoading(false).
 *
 * 2) After pass (handleSubmitPass): submitPass → setState; if playing && whose_turn !== 0, advanceGame
 *    then applyPlayResponse. submitting stays true until reveal finishes or no plays.
 *
 * 3) User plays (handlePlayCard): isSubmittingPlayRef blocks re-entry. submitPlay → applyPlayResponse.
 *    Ref cleared when reveal finishes or on error.
 *
 * 4) When it's AI's turn (useEffect): if !submitting && whose_turn !== 0, advanceGame → applyPlayResponse.
 *
 * 5) applyPlayResponse: setState(data) only (state never updated in a timer). If intermediate_plays,
 *    set reveal = { plays, count: 1 } and start one interval that only advances count;
 *    when done, set reveal = null and submitting false. Display = f(state, reveal).
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
   /** When non-null, we are revealing: plays to show, count, and cards that were already on the table (so we don't "reset" to fewer cards). */
   const [reveal, setReveal] = useState<{
      plays: PlayEvent[];
      count: number;
      existingBefore: PlayEvent[];
   } | null>(null);
   const revealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
   /** Block duplicate or stray card plays. */
   const isSubmittingPlayRef = useRef(false);
   /** Ref updated each render so applyPlayResponse can read "what was on the table" before we apply new state. */
   const prevTrickRef = useRef<PlayEvent[]>([]);


   useEffect(() => {
      return () => {
         if (revealIntervalRef.current) {
            clearInterval(revealIntervalRef.current);
            revealIntervalRef.current = null;
         }
      };
   }, []);

   if (state?.phase === "playing" && state.current_trick) {
      const ct = (state.current_trick.filter(Boolean) ?? []) as PlayEvent[];
      prevTrickRef.current = ct;
   }

   useEffect(() => {
      if (!state) return;
      const ct = state.current_trick?.filter(Boolean) ?? [];
      console.log("[HEARTS] state/reveal changed", {
         phase: state.phase,
         current_trick_len: ct.length,
         current_trick: ct.map((s) => (s ? `${s.player_index}:${s.card}` : null)),
         reveal: reveal
            ? { count: reveal.count, plays_len: reveal.plays.length }
            : null,
      });
   }, [state?.phase, state?.current_trick, reveal]);

   /** Apply API response once; optionally reveal plays one-by-one via a single interval. State is never updated in a timer. */
   const applyPlayResponse = useCallback((data: PlayResponse) => {
      const plays = data.intermediate_plays ?? [];
      const currentTrickLen = data.current_trick?.filter(Boolean).length ?? 0;
      console.log("[HEARTS] applyPlayResponse called", {
         plays_count: plays.length,
         current_trick_len: currentTrickLen,
         round_just_ended: data.round_just_ended,
         plays: plays.map((p) => `${p.player_index}:${p.card}`),
         current_trick: (data.current_trick ?? []).map((s) => (s ? `${s.player_index}:${s.card}` : null)),
      });
      if (revealIntervalRef.current) {
         clearInterval(revealIntervalRef.current);
         revealIntervalRef.current = null;
         console.log("[HEARTS] applyPlayResponse: cleared previous interval");
      }
      const refTrick = prevTrickRef.current ?? [];
      const existingLen = Math.max(0, refTrick.length - plays.length + 1);
      const existingBefore = existingLen > 0 ? refTrick.slice(0, existingLen) : refTrick.slice();
      console.log("[HEARTS] applyPlayResponse: existingBefore from ref", { ref_len: refTrick.length, plays_len: plays.length, existingLen, existingBefore_len: existingBefore.length, cards: existingBefore.map((p) => `${p.player_index}:${p.card}`) });
      setState(data);
      if (plays.length === 0) {
         console.log("[HEARTS] applyPlayResponse: no plays, setReveal(null), submitting=false");
         setReveal(null);
         setSubmitting(false);
         isSubmittingPlayRef.current = false;
         return;
      }
      console.log("[HEARTS] applyPlayResponse: setReveal({ plays, count: 1, existingBefore }), starting interval");
      setReveal({ plays, count: 1, existingBefore });
      const id = setInterval(() => {
         setReveal((prev) => {
            if (!prev || prev.plays !== plays) {
               console.log("[HEARTS] interval tick: stale prev or different plays, skipping");
               return prev;
            }
            const next = prev.count + 1;
            if (next > plays.length) {
               console.log("[HEARTS] interval: reveal done", { next, plays_length: plays.length });
               clearInterval(id);
               if (revealIntervalRef.current === id) revealIntervalRef.current = null;
               setReveal(null);
               setSubmitting(false);
               isSubmittingPlayRef.current = false;
               return prev;
            }
            console.log("[HEARTS] interval tick: count", prev.count, "->", next);
            return { plays, count: next, existingBefore: prev.existingBefore };
         });
      }, REVEAL_INTERVAL_MS);
      revealIntervalRef.current = id;
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
                        "[HEARTS] advanceGame (initial) success, applyPlayResponse",
                        {
                           intermediate_plays:
                              advResult.data.intermediate_plays?.length,
                           round_just_ended: advResult.data.round_just_ended,
                        }
                     );
                     setLoading(false);
                     setSubmitting(true);
                     applyPlayResponse(advResult.data);
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
   }, [gameId, applyPlayResponse]);

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
               "[HEARTS] advanceGame (post-play) success, applyPlayResponse",
               {
                  intermediate_plays: advResult.data.intermediate_plays?.length,
                  round_just_ended: advResult.data.round_just_ended,
               }
            );
            applyPlayResponse(advResult.data);
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
      applyPlayResponse,
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
                        "[HEARTS] handleSubmitPass advanceGame success, applyPlayResponse"
                     );
                     applyPlayResponse(advResult.data);
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
   }, [gameId, passSelection, applyPlayResponse]);

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
               applyPlayResponse(result.data);
            })
            .catch((e) => {
               console.log("[HEARTS] submitPlay catch", e);
               setError(e instanceof Error ? e.message : "Play failed");
               setSubmitting(false);
               isSubmittingPlayRef.current = false;
            });
      },
      [gameId, applyPlayResponse]
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
                              const phase = state.phase;
                              const currentTrickFiltered = (state.current_trick?.filter(Boolean) ?? []) as PlayEvent[];
                              const hasReveal = reveal !== null;
                              console.log("[HEARTS] slots compute", {
                                 phase,
                                 current_trick_len: currentTrickFiltered.length,
                                 reveal: hasReveal
                                    ? { count: reveal!.count, plays_len: reveal!.plays.length }
                                    : null,
                              });
                              if (phase === "passing") {
                                 console.log("[HEARTS] slots branch=passing -> empty");
                                 return [null, null, null, null];
                              }
                              if (reveal !== null) {
                                 const { plays: revPlays, count: revCount, existingBefore } = reveal;
                                 const n = Math.max(1, Math.min(revCount, revPlays.length));
                                 const slice = revPlays.slice(0, n);
                                 const toShow = existingBefore.concat(slice);
                                 console.log("[HEARTS] slots branch=reveal", {
                                    existingBefore_len: existingBefore.length,
                                    revCount,
                                    n,
                                    slice_len: slice.length,
                                    toShow_len: toShow.length,
                                    toShow: toShow.map((p) => `${p.player_index}:${p.card}`),
                                 });
                                 return buildSlotsFromPlays(toShow);
                              }
                              const padded: CurrentTrickSlot[] = [null, null, null, null];
                              for (const s of currentTrickFiltered)
                                 if (
                                    s &&
                                    typeof s.player_index === "number" &&
                                    s.player_index >= 0 &&
                                    s.player_index < 4
                                 )
                                    padded[s.player_index] = s;
                              console.log("[HEARTS] slots branch=state.current_trick", {
                                 current_trick_len: currentTrickFiltered.length,
                                 cards: currentTrickFiltered.map((p) => `${p.player_index}:${p.card}`),
                              });
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
