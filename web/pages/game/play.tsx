import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/buttons";
import { Hand } from "@/components/game/Hand";
import { Trick } from "@/components/game/Trick";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { usePlayQueue } from "@/hooks/usePlayQueue";
import {
   advanceGame,
   getGameState,
   submitPass,
   submitPlay,
} from "@/lib/game-api";
import {
   connect as connectGameSocket,
   disconnect as disconnectGameSocket,
   isConnected as isGameSocketConnected,
   onError as onGameSocketError,
   onPlay as onGameSocketPlay,
   onState as onGameSocketState,
   onTrickComplete as onGameSocketTrickComplete,
   sendAdvance as sendGameSocketAdvance,
   sendPlay as sendGameSocketPlay,
} from "@/lib/game-socket";
import type { CurrentTrickSlot, GameState, PlayEvent } from "@/types/game";
import type { GameSocketState } from "@/lib/game-socket";
import styles from "@/styles/play.module.css";

/** PageLayout body classes without top margin (mt-10) for play page layout */
const PLAY_PAGE_LAYOUT_CLASS =
   "w-[85vw] flex flex-col items-center justify-center text-center";

/**
 * Terminology:
 * - TRICK = four cards, one per player
 * - ROUND = all 13 tricks; after a round we pass, then start the next round
 */

/** Reorder for table layout: API order 0,1,2,3 -> display order bottom(0), top(2), left(1), right(3). */
function reorderSlotsForTableLayout<T>(arr: T[]): T[] {
   if (arr.length < 4) return arr;
   return [arr[0], arr[2], arr[1], arr[3]];
}

export default function PlayGamePage() {
   const router = useRouter();
   const { game_id: gameId } = router.query;

   // ── Core UI state ──────────────────────────────────────────────────
   const [loading, setLoading] = useState(true);
   const [notFound, setNotFound] = useState(false);
   const [state, setState] = useState<GameState | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false); // pass phase only
   const [passSelection, setPassSelection] = useState<Set<string>>(new Set());

   // ── Refs for WS callbacks (stable across renders) ──────────────────
   const pendingStateRef = useRef<GameSocketState | null>(null);
   const lastHumanCardRef = useRef<string | null>(null);
   const advanceSentRef = useRef(false);
   const stateRef = useRef(state);
   stateRef.current = state;

   // ── Play queue (animation) ─────────────────────────────────────────
   const applyPendingState = useCallback(() => {
      const pending = pendingStateRef.current;
      if (!pending) return;
      pendingStateRef.current = null;
      advanceSentRef.current = false;
      setState(pending);
      if (pending.phase === "passing") {
         // Will be handled by reset below via the hook reference
         resetRef.current();
      }
   }, []);

   // Ref indirection so the hook's onIdle can always call the latest applyPendingState
   const applyPendingRef = useRef(applyPendingState);
   applyPendingRef.current = applyPendingState;

   const onIdle = useCallback(() => {
      applyPendingRef.current();
   }, []);

   const {
      displaySlots,
      busy,
      currentTurn,
      enqueue,
      showImmediately,
      setSlots,
      reset,
   } = usePlayQueue({ onIdle });

   // Keep a stable ref to reset so applyPendingState (created before the hook)
   // can call it without a circular dependency.
   const resetRef = useRef(reset);
   resetRef.current = reset;

   const busyRef = useRef(busy);
   busyRef.current = busy;

   // ── REST fallback: load intermediate_plays into the queue ──────────
   const enqueueRestPlays = useCallback(
      (plays: PlayEvent[], initialOnTable: number, skipFirst: boolean) => {
         let onTable = initialOnTable;
         for (let i = 0; i < plays.length; i++) {
            if (skipFirst && i === 0) {
               onTable++;
               if (onTable === 4) {
                  enqueue({ type: "trick_complete" });
                  onTable = 0;
               }
               continue;
            }
            enqueue({ type: "play", event: plays[i] });
            onTable++;
            if (onTable === 4) {
               enqueue({ type: "trick_complete" });
               onTable = 0;
            }
         }
      },
      [enqueue]
   );

   // ── WebSocket: connect / disconnect ────────────────────────────────
   useEffect(() => {
      if (typeof gameId === "string" && gameId) {
         connectGameSocket(gameId);
         return () => disconnectGameSocket();
      }
   }, [gameId]);

   // ── WebSocket: event subscriptions ─────────────────────────────────
   useEffect(() => {
      const unsubPlay = onGameSocketPlay((ev: PlayEvent) => {
         if (
            ev.player_index === 0 &&
            ev.card === lastHumanCardRef.current
         ) {
            lastHumanCardRef.current = null;
            return;
         }
         enqueue({ type: "play", event: ev });
      });

      const unsubTrick = onGameSocketTrickComplete(() => {
         enqueue({ type: "trick_complete" });
      });

      const unsubState = onGameSocketState((data: GameSocketState) => {
         advanceSentRef.current = false;
         pendingStateRef.current = data;
         if (data.round_just_ended) {
            enqueue({ type: "trick_complete" });
            return;
         }
         if (!busyRef.current) {
            applyPendingRef.current();
         }
      });

      const unsubError = onGameSocketError((msg: string) => {
         setError(msg);
      });

      return () => {
         unsubPlay();
         unsubTrick();
         unsubState();
         unsubError();
      };
   }, [enqueue]);

   // ── Initial load ───────────────────────────────────────────────────
   useEffect(() => {
      if (typeof gameId !== "string" || !gameId) {
         setLoading(false);
         return;
      }
      let cancelled = false;
      setLoading(true);
      setNotFound(false);
      setError(null);

      getGameState(gameId)
         .then((result) => {
            if (cancelled) return;
            if (!result.ok) {
               if (result.notFound) setNotFound(true);
               else setError(result.error);
               setLoading(false);
               return;
            }
            const data = result.data;
            setState(data);
            setLoading(false);

            // Restore board if there are cards on the table already
            if (data.phase === "playing" && data.current_trick) {
               const slots: CurrentTrickSlot[] = [null, null, null, null];
               for (const s of data.current_trick) {
                  if (
                     s &&
                     typeof s.player_index === "number" &&
                     s.player_index >= 0 &&
                     s.player_index < 4
                  ) {
                     slots[s.player_index] = s;
                  }
               }
               setSlots(slots);
            }
            // If it's the AI's turn, the AI turn effect will handle advance.
         })
         .catch((e) => {
            if (cancelled) return;
            setError(e instanceof Error ? e.message : "Failed to load game");
            setLoading(false);
         });

      return () => {
         cancelled = true;
      };
   }, [gameId, setSlots]);

   // ── AI turn: advance when it's not the human's turn ────────────────
   useEffect(() => {
      if (
         typeof gameId !== "string" ||
         !gameId ||
         !state ||
         state.phase !== "playing" ||
         state.game_over ||
         state.whose_turn === 0 ||
         loading ||
         busy ||
         advanceSentRef.current
      ) {
         return;
      }

      advanceSentRef.current = true;

      if (isGameSocketConnected()) {
         sendGameSocketAdvance();
      } else {
         const onTable =
            stateRef.current?.current_trick?.filter(Boolean).length ?? 0;
         advanceGame(gameId)
            .then((result) => {
               if (!result.ok) {
                  setError(result.error);
                  advanceSentRef.current = false;
                  return;
               }
               const plays = result.data.intermediate_plays ?? [];
               enqueueRestPlays(plays, onTable, false);
               pendingStateRef.current = result.data;
               if (result.data.round_just_ended) {
                  enqueue({ type: "trick_complete" });
               }
               if (plays.length === 0 && !result.data.round_just_ended) {
                  applyPendingRef.current();
               }
            })
            .catch((e) => {
               setError(
                  e instanceof Error ? e.message : "Failed to advance game"
               );
               advanceSentRef.current = false;
            });
      }
   }, [
      gameId,
      state?.phase,
      state?.whose_turn,
      state?.game_over,
      loading,
      busy,
      enqueue,
      enqueueRestPlays,
   ]);

   // ── Handlers ───────────────────────────────────────────────────────
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
            setSubmitting(false);
            reset();
         })
         .catch((e) => {
            setError(e instanceof Error ? e.message : "Submit failed");
            setSubmitting(false);
         });
   }, [gameId, passSelection, reset]);

   const handlePlayCard = useCallback(
      (code: string) => {
         if (typeof gameId !== "string") return;

         const cardsOnTable =
            stateRef.current?.current_trick?.filter(Boolean).length ?? 0;

         showImmediately({ player_index: 0, card: code });
         lastHumanCardRef.current = code;

         // Optimistically update: remove card from hand, disable further clicks.
         // Keep whose_turn at 0 so the AI turn effect doesn't fire a spurious
         // advance -- submit_play always runs AI until it's human's turn again.
         setState((prev) =>
            prev
               ? {
                    ...prev,
                    human_hand: prev.human_hand.filter((c) => c !== code),
                    legal_plays: [],
                 }
               : prev
         );

         if (isGameSocketConnected()) {
            sendGameSocketPlay(code);
         } else {
            submitPlay(gameId, { card: code })
               .then((result) => {
                  if (!result.ok) {
                     setError(result.error);
                     return;
                  }
                  const plays = result.data.intermediate_plays ?? [];
                  enqueueRestPlays(plays, cardsOnTable + 1, true);
                  pendingStateRef.current = result.data;
                  if (result.data.round_just_ended) {
                     enqueue({ type: "trick_complete" });
                  }
                  if (plays.length <= 1 && !result.data.round_just_ended) {
                     applyPendingRef.current();
                  }
               })
               .catch((e) => {
                  setError(
                     e instanceof Error ? e.message : "Play failed"
                  );
               });
         }
      },
      [gameId, showImmediately, enqueue, enqueueRestPlays]
   );

   // ── Early returns ──────────────────────────────────────────────────
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

   // ── Derived display values ─────────────────────────────────────────
   // During animation, use the queue's currentTurn for the seat highlight;
   // when idle, fall back to the game state's whose_turn.
   const whoseTurn = busy ? currentTurn : state?.whose_turn ?? null;

   const slots = displaySlots;
   const heartOrQueenOnTable = slots.some(
      (s) =>
         s &&
         (s.card.toLowerCase().endsWith("h") ||
            s.card.toLowerCase() === "qs")
   );
   const heartsBrokenForDisplay =
      (state?.hearts_broken ?? false) || heartOrQueenOnTable;

   // ── Main render ────────────────────────────────────────────────────
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
                     {/* Top (player 2) */}
                     <div
                        className={`${styles.gameTableSeat} ${
                           styles.gameTableSeatTop
                        } ${
                           state.phase === "playing" &&
                           !state.game_over &&
                           whoseTurn === 2
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
                     {/* Left (player 1) */}
                     <div
                        className={`${styles.gameTableSeat} ${
                           styles.gameTableSeatLeft
                        } ${
                           state.phase === "playing" &&
                           !state.game_over &&
                           whoseTurn === 1
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
                     {/* Center: trick + hearts icon */}
                     <div className={styles.tableCenter}>
                        <Trick
                           layout="table"
                           slots={slots}
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
                                       color: heartsBrokenForDisplay
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
                           whoseTurn === 3
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
                           whoseTurn === 0
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
                        {busy
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
                           !busy &&
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
