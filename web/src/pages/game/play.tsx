import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/Buttons";
import {
   GameOverBlock,
   GameSeat,
   Hand,
   HeartIcon,
   InfoButton,
   InfoModal,
   InfoPill,
   MobileGameTable,
   PhaseHint,
   RoundSummaryOverlay,
   ShootTheMoonOverlay,
   Trick,
} from "@/components/game";
import type { ShootTheMoonData } from "@/components/game/ShootTheMoonOverlay";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { usePlayQueue } from "@/hooks/usePlayQueue";
import {
   advanceGame,
   getGameState,
   recordGameStats,
   submitPass,
   submitPlay,
} from "@/lib/gameApi";
import { useAuth } from "@/context/AuthContext";
import { useSound } from "@/context/SoundContext";
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
} from "@/lib/gameSocket";
import type { CurrentTrickSlot, GameState, PlayEvent } from "@/types/game";
import type { GameSocketState } from "@/lib/gameSocket";
import { PLAY_PAGE_LAYOUT_CLASS } from "@/lib/constants";
import { useIsMobile } from "@/hooks/useIsMobile";
import handStyles from "@/components/game/Hand.module.css";
import styles from "@/styles/play.module.css";

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

/** Derive compact badge label for mobile: "AI 1" → "A1", "Guest 1" → "G1", "shmemcat" → "S". */
function getShortName(name: string): string {
   const trimmed = name.trim();
   const guestMatch = trimmed.match(/^Guest\s*(\d+)$/i);
   if (guestMatch) return `G${guestMatch[1]}`;
   if (trimmed === "You") return "Y";
   return trimmed.charAt(0).toUpperCase();
}

export default function PlayGamePage() {
   const [searchParams] = useSearchParams();
   const gameId = searchParams.get("game_id") ?? "";
   const { token } = useAuth();
   const isMobile = useIsMobile();
   const { play: playSound } = useSound();

   // ── Stats tracking ──────────────────────────────────────────────────
   const humanMoonShotsRef = useRef(0);
   const statsRecordedRef = useRef(false);
   const midRoundMoonShownRef = useRef(false);
   const moonOverlayActiveRef = useRef(false);
   const moonAdjustmentRef = useRef<number[]>([0, 0, 0, 0]);
   const handleContinueRoundRef = useRef<() => void>(() => {});

   // ── Core UI state ──────────────────────────────────────────────────
   const [loading, setLoading] = useState(true);
   const [notFound, setNotFound] = useState(false);
   const [state, setState] = useState<GameState | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false); // pass phase only
   const [infoModalOpen, setInfoModalOpen] = useState(false);
   const [passSelection, setPassSelection] = useState<Set<string>>(new Set());
   const [roundSummary, setRoundSummary] = useState<{
      deltas: number[];
      round: number;
      players: { name: string; score: number }[];
   } | null>(null);
   const [passTransition, setPassTransition] = useState<{
      phase: "exiting" | "gap" | "entering";
      displayHand: string[];
      exitingCodes?: Set<string>;
      exitDir?: "left" | "right" | "up";
      enteringCodes?: Set<string>;
      enterDir?: "left" | "right" | "above";
   } | null>(null);
   const [shootTheMoon, setShootTheMoon] = useState<ShootTheMoonData | null>(
      null
   );
   const [heartsPerPlayer, setHeartsPerPlayer] = useState<number[]>([
      0, 0, 0, 0,
   ]);
   const [noPassHold, setNoPassHold] = useState(false);
   const [roundBanner, setRoundBanner] = useState<{
      round: number;
   } | null>(null);
   const [dealingHand, setDealingHand] = useState(false);

   // ── Refs for WS callbacks (stable across renders) ──────────────────
   const pendingStateRef = useRef<GameSocketState | null>(null);
   const lastHumanCardRef = useRef<string | null>(null);
   const advanceSentRef = useRef(false);
   const stateRef = useRef(state);
   stateRef.current = state;
   const prevScoresRef = useRef<number[]>([0, 0, 0, 0]);
   const roundPendingStateRef = useRef<GameSocketState | null>(null);
   const setRoundSummaryRef = useRef(setRoundSummary);
   setRoundSummaryRef.current = setRoundSummary;
   const setShootTheMoonRef = useRef(setShootTheMoon);
   setShootTheMoonRef.current = setShootTheMoon;

   // ── Play queue (animation) ─────────────────────────────────────────
   const applyPendingState = useCallback(() => {
      const pending = pendingStateRef.current;
      if (!pending) return;

      // If mid-round moon overlay is still active and round ended, defer
      if (pending.round_just_ended && moonOverlayActiveRef.current) {
         return;
      }

      pendingStateRef.current = null;
      advanceSentRef.current = false;

      // Intercept round-end: show round summary instead of transitioning
      if (pending.round_just_ended) {
         const deltas = pending.players.map(
            (p: { score: number }, i: number) =>
               p.score - prevScoresRef.current[i]
         );

         prevScoresRef.current = pending.players.map(
            (p: { score: number }) => p.score
         );
         roundPendingStateRef.current = pending;
         const currentRound = stateRef.current?.round ?? 1;
         const roundPlayers = pending.players.map(
            (p: { name: string; score: number }) => ({
               name: p.name,
               score: p.score,
            })
         );

         // Detect shoot-the-moon: one player at 0 and all others at +26
         // (skip if already shown mid-round)
         if (midRoundMoonShownRef.current) {
            midRoundMoonShownRef.current = false;
            setShootTheMoonRef.current(null);
         } else {
            const zeroCount = deltas.filter((d: number) => d === 0).length;
            const twentySixCount = deltas.filter(
               (d: number) => d === 26
            ).length;
            if (zeroCount === 1 && twentySixCount === 3) {
               const shooterIdx = deltas.indexOf(0);
               if (shooterIdx === 0) {
                  humanMoonShotsRef.current += 1;
               }
               setShootTheMoonRef.current({
                  shooterIndex: shooterIdx,
                  deltas,
                  round: currentRound,
                  players: roundPlayers,
               });
            } else {
               setShootTheMoonRef.current(null);
            }
         }

         setRoundSummaryRef.current({
            deltas,
            round: currentRound,
            players: roundPlayers,
         });
         return;
      }

      setState(pending);
      prevScoresRef.current = pending.players.map(
         (p: { score: number }) => p.score
      );
      if (pending.phase === "passing") {
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
      trickResult,
      collectTarget,
      enqueue,
      showImmediately,
      setSlots,
      reset,
      isActive,
   } = usePlayQueue({ onIdle });

   // Keep a stable ref to reset so applyPendingState (created before the hook)
   // can call it without a circular dependency.
   const resetRef = useRef(reset);
   resetRef.current = reset;

   const busyRef = useRef(busy);
   busyRef.current = busy;

   // ── REST fallback: load intermediate_plays into the queue ──────────
   const enqueueRestPlays = useCallback(
      (
         plays: PlayEvent[],
         initialOnTable: number,
         skipFirst: boolean
      ): number => {
         let onTable = initialOnTable;
         for (let i = 0; i < plays.length; i++) {
            if (skipFirst && i === 0) {
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
         return onTable;
      },
      [enqueue]
   );

   // ── WebSocket: connect / disconnect ────────────────────────────────
   useEffect(() => {
      if (gameId) {
         connectGameSocket(gameId);
         return () => disconnectGameSocket();
      }
   }, [gameId]);

   // ── WebSocket: event subscriptions ─────────────────────────────────
   useEffect(() => {
      const unsubPlay = onGameSocketPlay((ev: PlayEvent) => {
         if (ev.player_index === 0 && ev.card === lastHumanCardRef.current) {
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
            if (!isActive()) {
               applyPendingRef.current();
            }
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
   }, [enqueue, isActive]);

   // ── Initial load ───────────────────────────────────────────────────
   useEffect(() => {
      if (!gameId) {
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
            prevScoresRef.current = data.players.map(
               (p: { score: number }) => p.score
            );
            setRoundBanner({ round: data.round });

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

   // ── Record stats when game ends ───────────────────────────────────
   useEffect(() => {
      if (!state?.game_over || statsRecordedRef.current || !token || !gameId)
         return;
      statsRecordedRef.current = true;
      const humanScore = state.players[0]?.score ?? 0;
      const won = state.winner_index === 0;
      recordGameStats(token, {
         game_id: gameId,
         final_score: humanScore,
         won,
         moon_shots: humanMoonShotsRef.current,
      });
   }, [state?.game_over, state?.winner_index, state?.players, token, gameId]);

   // ── AI turn: advance when it's not the human's turn ────────────────
   useEffect(() => {
      if (
         !gameId ||
         !state ||
         state.phase !== "playing" ||
         state.game_over ||
         state.whose_turn === 0 ||
         loading ||
         busy ||
         noPassHold ||
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
               const finalOnTable = enqueueRestPlays(plays, onTable, false);
               pendingStateRef.current = result.data;
               if (result.data.round_just_ended && finalOnTable !== 0) {
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [
      gameId,
      state?.phase,
      state?.whose_turn,
      state?.game_over,
      loading,
      busy,
      noPassHold,
      enqueue,
      enqueueRestPlays,
   ]);

   // ── Round banner → deal timer ─────────────────────────────────────
   useEffect(() => {
      if (!roundBanner) return;
      const t = setTimeout(() => {
         setRoundBanner(null);
         setDealingHand(true);
      }, 1000);
      return () => clearTimeout(t);
   }, [roundBanner]);

   useEffect(() => {
      if (!dealingHand) return;
      const t = setTimeout(() => setDealingHand(false), 350);
      return () => clearTimeout(t);
   }, [dealingHand]);

   // ── Hearts-per-player tracking (client-side, per round) ───────────
   const currentRound = state?.round;
   const [heartsVisuallyBroken, setHeartsVisuallyBroken] = useState(false);
   useEffect(() => {
      setHeartsPerPlayer([0, 0, 0, 0]);
      setHeartsVisuallyBroken(false);
      midRoundMoonShownRef.current = false;
      moonOverlayActiveRef.current = false;
      moonAdjustmentRef.current = [0, 0, 0, 0];
   }, [currentRound]);

   // Track when a heart/QS first appears on the visible trick table
   useEffect(() => {
      const hasHeartOrQs = displaySlots.some(
         (s) =>
            s &&
            (s.card.toLowerCase().endsWith("h") ||
               s.card.toLowerCase() === "qs")
      );
      if (hasHeartOrQs) {
         setHeartsVisuallyBroken(true);
      }
   }, [displaySlots]);

   useEffect(() => {
      if (trickResult && trickResult.hearts > 0) {
         setHeartsPerPlayer((prev) => {
            const next = [...prev];
            next[trickResult.winner] += trickResult.hearts;
            return next;
         });
      }
   }, [trickResult]);

   // Detect shoot-the-moon mid-round (a player accumulated all 26 points)
   useEffect(() => {
      if (midRoundMoonShownRef.current) return;
      if (!state || state.phase !== "playing") return;
      const shooterIdx = heartsPerPlayer.findIndex((h) => h === 26);
      if (shooterIdx === -1) return;
      midRoundMoonShownRef.current = true;
      moonOverlayActiveRef.current = true;
      if (shooterIdx === 0) {
         humanMoonShotsRef.current += 1;
      }
      setShootTheMoon({
         shooterIndex: shooterIdx,
         deltas: heartsPerPlayer.map((_, i) => (i === shooterIdx ? 0 : 26)),
         round: currentRound ?? 1,
         players: state.players.map((p) => ({ name: p.name, score: p.score })),
      });
   }, [heartsPerPlayer, state, currentRound]);

   // ── Sound effects ────────────────────────────────────────────────────
   const playSoundRef = useRef(playSound);
   playSoundRef.current = playSound;

   // 1a. Round banner pop ("Round X")
   useEffect(() => {
      if (roundBanner) playSoundRef.current("heartDelta");
   }, [roundBanner]);

   // 1b. Hand deal-in fan
   useEffect(() => {
      if (dealingHand) playSoundRef.current("cardFan");
   }, [dealingHand]);

   // 2. Card played (new card appears on trick table)
   const prevSlotsRef = useRef(displaySlots);
   useEffect(() => {
      const prev = prevSlotsRef.current;
      const appeared = displaySlots.some(
         (s, i) => s != null && prev[i] == null
      );
      prevSlotsRef.current = displaySlots;
      if (appeared) playSoundRef.current("cardSlide");
   }, [displaySlots]);

   // 3. Trick sweep (cards collected toward winner)
   useEffect(() => {
      if (collectTarget != null) playSoundRef.current("cardSweep");
   }, [collectTarget]);

   // 4. Heart badge delta pop
   useEffect(() => {
      if (trickResult && trickResult.hearts > 0)
         playSoundRef.current("heartDelta");
   }, [trickResult]);

   // 5. Round end
   useEffect(() => {
      if (roundSummary) playSoundRef.current("roundEnd");
   }, [roundSummary]);

   // 6. Game over (one-shot)
   const gameOverSoundRef = useRef(false);
   useEffect(() => {
      if (state?.game_over && !gameOverSoundRef.current) {
         gameOverSoundRef.current = true;
         playSoundRef.current("gameEnd");
      }
   }, [state?.game_over]);

   // 7. Pass transition (exiting = cards leaving, entering = cards arriving)
   useEffect(() => {
      if (
         passTransition?.phase === "exiting" ||
         passTransition?.phase === "entering"
      ) {
         playSoundRef.current("cardSweep");
      }
   }, [passTransition?.phase]);

   // ── Handlers ───────────────────────────────────────────────────────
   const handlePassCardToggle = useCallback((code: string) => {
      setPassSelection((prev) => {
         const next = new Set(prev);
         if (next.has(code)) {
            next.delete(code);
            playSoundRef.current("cardPlace");
         } else if (next.size < 3) {
            next.add(code);
            playSoundRef.current("cardPlace");
         }
         return next;
      });
   }, []);

   const handleSubmitPass = useCallback(() => {
      if (!gameId || passSelection.size !== 3) return;
      const currentState = stateRef.current;
      if (!currentState) return;

      const passDir = currentState.pass_direction;
      const exitDir: "left" | "right" | "up" =
         passDir === "left" ? "left" : passDir === "right" ? "right" : "up";
      const enterDir: "left" | "right" | "above" =
         passDir === "left" ? "right" : passDir === "right" ? "left" : "above";

      const oldHand = [...currentState.human_hand];
      const passedSet = new Set(passSelection);
      const cards = Array.from(passSelection) as [string, string, string];

      setSubmitting(true);
      setPassSelection(new Set());

      // Phase 1: slide passed cards out (keep them selected/raised for continuity)
      setPassTransition({
         phase: "exiting",
         displayHand: oldHand,
         exitingCodes: passedSet,
         exitDir,
      });

      const apiPromise = submitPass(gameId, { cards });
      const exitTimer = new Promise<void>((r) => setTimeout(r, 400));

      Promise.all([apiPromise, exitTimer])
         .then(([result]) => {
            if (!result.ok) {
               setError(result.error);
               setPassTransition(null);
               setSubmitting(false);
               return;
            }

            const newHand: string[] = result.data.human_hand;
            const remainingHand = oldHand.filter((c) => !passedSet.has(c));
            const remainingSet = new Set(remainingHand);
            const received = newHand.filter(
               (c: string) => !remainingSet.has(c)
            );
            const receivedSet = new Set(received);

            // Phase 2: show hand with passed cards removed (brief gap)
            setPassTransition({
               phase: "gap",
               displayHand: remainingHand,
            });

            setTimeout(() => {
               // Phase 3: show full new hand with received cards entering
               setPassTransition({
                  phase: "entering",
                  displayHand: newHand,
                  enteringCodes: receivedSet,
                  enterDir,
               });

               // After enter + settle animation, transition is done
               setTimeout(() => {
                  setPassTransition(null);
                  setState(result.data);
                  setSubmitting(false);
                  reset();
               }, 1600);
            }, 500);
         })
         .catch((e) => {
            setError(e instanceof Error ? e.message : "Submit failed");
            setPassTransition(null);
            setSubmitting(false);
         });
   }, [gameId, passSelection, reset]);

   const handleContinueRound = useCallback(() => {
      moonAdjustmentRef.current = [0, 0, 0, 0];
      const pending = roundPendingStateRef.current;
      roundPendingStateRef.current = null;
      setRoundSummary(null);
      setShootTheMoon(null);
      if (pending) {
         setState(pending);
         prevScoresRef.current = pending.players.map(
            (p: { score: number }) => p.score
         );
         setRoundBanner({ round: pending.round });
         if (pending.phase === "passing") {
            reset();
         }
         if (pending.pass_direction === "none") {
            reset();
            if (pending.current_trick?.length > 0) {
               const slots: CurrentTrickSlot[] = [null, null, null, null];
               for (const s of pending.current_trick) {
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
            setNoPassHold(true);
            setTimeout(() => setNoPassHold(false), 2500);
         }
      }
   }, [reset, setSlots]);
   handleContinueRoundRef.current = handleContinueRound;

   const handleMidRoundMoonContinue = useCallback(() => {
      if (!shootTheMoon) return;
      const shooterIdx = shootTheMoon.shooterIndex;
      moonAdjustmentRef.current = [0, 1, 2, 3].map((i) =>
         i === shooterIdx ? 0 : 26
      );
      moonOverlayActiveRef.current = false;
      setShootTheMoon(null);

      // If the round ended while the overlay was showing, process it now
      // (shows round summary without re-showing the moon celebration)
      if (pendingStateRef.current?.round_just_ended) {
         applyPendingState();
      }
   }, [shootTheMoon, applyPendingState]);

   const handlePlayCard = useCallback(
      (code: string) => {
         if (!gameId) return;

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
                  const finalOnTable = enqueueRestPlays(
                     plays,
                     cardsOnTable + 1,
                     true
                  );
                  pendingStateRef.current = result.data;
                  if (result.data.round_just_ended && finalOnTable !== 0) {
                     enqueue({ type: "trick_complete" });
                  }
                  if (plays.length <= 1 && !result.data.round_just_ended) {
                     applyPendingRef.current();
                  }
               })
               .catch((e) => {
                  setError(e instanceof Error ? e.message : "Play failed");
               });
         }
      },
      [gameId, showImmediately, enqueue, enqueueRestPlays]
   );

   // ── Early returns ──────────────────────────────────────────────────
   if (!gameId) {
      return (
         <>
            <Helmet>
               <title>Play Game | Hearts</title>
            </Helmet>
            <PageLayout
               title="PLAY GAME"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <p>No game specified.</p>
               <ButtonGroup className="pt-4">
                  <Link to="/game/create">
                     <Button name="Create Game" style={{ width: "250px" }} />
                  </Link>
                  <Link to="/" onClick={() => triggerLogoFadeOut()}>
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
            <Helmet>
               <title>Play Game | Hearts</title>
            </Helmet>
            <PageLayout
               title="PLAY GAME"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <div className="animate-pulse flex flex-col gap-4 w-full max-w-md">
                  <div className="h-8 bg-mediumpink rounded w-1/3" />
                  <div className="h-24 bg-mediumpink rounded" />
                  <div className="h-32 bg-mediumpink rounded" />
               </div>
            </PageLayout>
         </>
      );
   }

   if (notFound) {
      return (
         <>
            <Helmet>
               <title>Game Not Found | Hearts</title>
            </Helmet>
            <PageLayout
               title="PLAY GAME"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <p>Game not found.</p>
               <ButtonGroup className="pt-4">
                  <Link to="/game/create">
                     <Button name="Create Game" style={{ width: "200px" }} />
                  </Link>
                  <Link to="/" onClick={() => triggerLogoFadeOut()}>
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
            <Helmet>
               <title>Play Game | Hearts</title>
            </Helmet>
            <PageLayout
               title="PLAY GAME"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <p className="text-red-600" role="alert">
                  {error}
               </p>
               <ButtonGroup className="pt-4">
                  <Link to="/game/create">
                     <Button
                        name="Create New Game"
                        style={{ width: "250px" }}
                     />
                  </Link>
                  <Link to="/" onClick={() => triggerLogoFadeOut()}>
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
   const heartsBrokenForDisplay = heartsVisuallyBroken;

   // ── Seat display helpers ────────────────────────────────────────────
   const showHeartsOnSeats =
      state?.phase === "playing" && !roundSummary && !state?.game_over;
   const seatIsCurrentTurn = (i: number) =>
      !roundSummary &&
      state?.phase === "playing" &&
      !state?.game_over &&
      whoseTurn === i;
   const seatScore = (i: number) =>
      roundSummary
         ? roundSummary.players[i]?.score ?? 0
         : (state?.players[i]?.score ?? 0) + moonAdjustmentRef.current[i];
   // ── Main render ────────────────────────────────────────────────────
   return (
      <>
         <Helmet>
            <title>Play Game | Hearts</title>
         </Helmet>
         <PageLayout
            title="PLAY GAME"
            hideTitleBlock
            className={PLAY_PAGE_LAYOUT_CLASS}
         >
            {state && (
               <div className={styles.playContent}>
                  {!roundSummary && !isMobile && (
                     <InfoPill
                        round={state.round}
                        passDirection={state.pass_direction}
                        phase={state.phase}
                     />
                  )}
                  {!roundSummary && isMobile && (
                     <InfoButton onClick={() => setInfoModalOpen(true)} />
                  )}
                  {infoModalOpen && isMobile && (
                     <InfoModal
                        round={state.round}
                        passDirection={state.pass_direction}
                        phase={state.phase}
                        players={state.players}
                        onClose={() => setInfoModalOpen(false)}
                     />
                  )}

                  <div className={styles.gameTableWrapper}>
                     {isMobile ? (
                        <MobileGameTable
                           seats={[
                              {
                                 name: state.players[0]?.name ?? "You",
                                 shortName: getShortName(
                                    state.players[0]?.name ?? "You"
                                 ),
                                 seatIndex: 0,
                                 score: seatScore(0),
                                 position: "bottom" as const,
                                 isCurrentTurn: seatIsCurrentTurn(0),
                                 showHearts: !!showHeartsOnSeats,
                                 heartCount: heartsPerPlayer[0],
                              },
                              {
                                 name: state.players[1]?.name ?? "—",
                                 shortName: getShortName(
                                    state.players[1]?.name ?? "—"
                                 ),
                                 seatIndex: 1,
                                 score: seatScore(1),
                                 position: "left" as const,
                                 isCurrentTurn: seatIsCurrentTurn(1),
                                 showHearts: !!showHeartsOnSeats,
                                 heartCount: heartsPerPlayer[1],
                              },
                              {
                                 name: state.players[2]?.name ?? "—",
                                 shortName: getShortName(
                                    state.players[2]?.name ?? "—"
                                 ),
                                 seatIndex: 2,
                                 score: seatScore(2),
                                 position: "top" as const,
                                 isCurrentTurn: seatIsCurrentTurn(2),
                                 showHearts: !!showHeartsOnSeats,
                                 heartCount: heartsPerPlayer[2],
                              },
                              {
                                 name: state.players[3]?.name ?? "—",
                                 shortName: getShortName(
                                    state.players[3]?.name ?? "—"
                                 ),
                                 seatIndex: 3,
                                 score: seatScore(3),
                                 position: "right" as const,
                                 isCurrentTurn: seatIsCurrentTurn(3),
                                 showHearts: !!showHeartsOnSeats,
                                 heartCount: heartsPerPlayer[3],
                              },
                           ]}
                           trickSlots={slots}
                           collectTarget={collectTarget}
                           playerNames={reorderSlotsForTableLayout(
                              state.players.map((p) => p.name)
                           )}
                           centerIcon={
                              !roundSummary && state.phase === "playing" ? (
                                 <HeartIcon
                                    size={40}
                                    color={
                                       heartsBrokenForDisplay
                                          ? "hsl(0, 65%, 50%)"
                                          : "var(--darkpink)"
                                    }
                                    style={{
                                       transition: "color 0.5s ease",
                                    }}
                                 />
                              ) : undefined
                           }
                        />
                     ) : (
                        <div className={styles.gameTable}>
                           {/* Top (player 2) */}
                           <GameSeat
                              name={state.players[2]?.name ?? "—"}
                              shortName={getShortName(
                                 state.players[2]?.name ?? "—"
                              )}
                              seatIndex={2}
                              score={seatScore(2)}
                              position="top"
                              isCurrentTurn={seatIsCurrentTurn(2)}
                              showHearts={!!showHeartsOnSeats}
                              heartCount={heartsPerPlayer[2]}
                           />
                           {/* Left (player 1) */}
                           <GameSeat
                              name={state.players[1]?.name ?? "—"}
                              shortName={getShortName(
                                 state.players[1]?.name ?? "—"
                              )}
                              seatIndex={1}
                              score={seatScore(1)}
                              position="left"
                              isCurrentTurn={seatIsCurrentTurn(1)}
                              showHearts={!!showHeartsOnSeats}
                              heartCount={heartsPerPlayer[1]}
                           />
                           {/* Center: trick + hearts icon */}
                           <div className={styles.tableCenter}>
                              <Trick
                                 layout="table"
                                 slots={slots}
                                 collectTarget={collectTarget}
                                 playerNames={reorderSlotsForTableLayout(
                                    state.players.map((p) => p.name)
                                 )}
                                 centerIcon={
                                    !roundSummary &&
                                    state.phase === "playing" ? (
                                       <HeartIcon
                                          size={40}
                                          color={
                                             heartsBrokenForDisplay
                                                ? "hsl(0, 65%, 50%)"
                                                : "var(--darkpink)"
                                          }
                                          style={{
                                             transition: "color 0.5s ease",
                                          }}
                                       />
                                    ) : undefined
                                 }
                              />
                           </div>
                           {/* Right (player 3) */}
                           <GameSeat
                              name={state.players[3]?.name ?? "—"}
                              shortName={getShortName(
                                 state.players[3]?.name ?? "—"
                              )}
                              seatIndex={3}
                              score={seatScore(3)}
                              position="right"
                              isCurrentTurn={seatIsCurrentTurn(3)}
                              showHearts={!!showHeartsOnSeats}
                              heartCount={heartsPerPlayer[3]}
                           />
                           {/* Bottom (player 0 = human) */}
                           <GameSeat
                              name={state.players[0]?.name ?? "You"}
                              shortName={getShortName(
                                 state.players[0]?.name ?? "You"
                              )}
                              seatIndex={0}
                              score={seatScore(0)}
                              position="bottom"
                              isCurrentTurn={seatIsCurrentTurn(0)}
                              showHearts={!!showHeartsOnSeats}
                              heartCount={heartsPerPlayer[0]}
                           />
                        </div>
                     )}

                     {/* ── Centered pass button in table ──────────── */}
                     {!roundSummary &&
                        !roundBanner &&
                        !dealingHand &&
                        state.phase === "passing" &&
                        !passTransition && (
                           <div className={styles.passCenter}>
                              <Button
                                 name="Submit Pass"
                                 disabled={
                                    passSelection.size !== 3 || submitting
                                 }
                                 onClick={handleSubmitPass}
                                 style={{
                                    height: "52px",
                                    width: "110px",
                                    lineHeight: "1.2",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                 }}
                              >
                                 <span>submit</span>
                                 <span>pass</span>
                              </Button>
                           </div>
                        )}

                     {/* ── Shoot the Moon overlay ────────────────────── */}
                     {shootTheMoon && (
                        <ShootTheMoonOverlay
                           {...shootTheMoon}
                           onContinue={
                              roundSummary
                                 ? handleContinueRound
                                 : handleMidRoundMoonContinue
                           }
                        />
                     )}

                     {/* ── Round summary overlay ───────────────────── */}
                     {roundSummary && !shootTheMoon && (
                        <RoundSummaryOverlay
                           summary={roundSummary}
                           onContinue={handleContinueRound}
                        />
                     )}

                     {/* ── Round banner (start-of-round) ────────────── */}
                     {roundBanner && !roundSummary && (
                        <div className={styles.roundBannerOverlay}>
                           <span className={styles.roundBannerText}>
                              Round {roundBanner.round}
                           </span>
                        </div>
                     )}
                  </div>
                  {/* end gameTableWrapper */}

                  {/* ── Phase hint (always in DOM to prevent layout shift) ── */}
                  <PhaseHint
                     text={
                        roundSummary ||
                        roundBanner ||
                        dealingHand ||
                        state.game_over
                           ? null
                           : noPassHold
                           ? isMobile
                              ? null
                              : "No passing this round"
                           : state.phase === "playing"
                           ? isMobile
                              ? null
                              : busy
                              ? "Playing…"
                              : state.whose_turn === 0
                              ? "Your turn"
                              : "Waiting for others…"
                           : state.phase === "passing" && !passTransition
                           ? `Select 3 cards to pass ${state.pass_direction}.`
                           : null
                     }
                  />

                  {/* ── Hand placeholder (preserves layout during round summary / banner) ── */}
                  {(roundSummary || roundBanner) && !passTransition && (
                     <div className={handStyles.hand} aria-hidden="true">
                        <div key={0} className={handStyles.handCardWrap}>
                           <div className={handStyles.handSlotEmpty} />
                        </div>
                     </div>
                  )}

                  {/* ── Pass transition (animated hand) ─────────── */}
                  {passTransition && (
                     <Hand
                        cards={passTransition.displayHand}
                        selectedCodes={
                           passTransition.phase === "exiting"
                              ? passTransition.exitingCodes
                              : undefined
                        }
                        selectionMode={passTransition.phase === "exiting"}
                        exitingCodes={
                           passTransition.phase === "exiting"
                              ? passTransition.exitingCodes
                              : undefined
                        }
                        exitDirection={passTransition.exitDir}
                        enteringCodes={
                           passTransition.phase === "entering"
                              ? passTransition.enteringCodes
                              : undefined
                        }
                        enterDirection={passTransition.enterDir}
                     />
                  )}

                  {/* ── Deal-in animation (hand expanding from center) ── */}
                  {dealingHand && !roundSummary && (
                     <div className={handStyles.handStack}>
                        <div className={handStyles.hand} aria-hidden="true">
                           <div className={handStyles.handCardWrap}>
                              <div className={handStyles.handSlotEmpty} />
                           </div>
                        </div>
                        <div className={handStyles.handDealIn}>
                           <Hand cards={state.human_hand} />
                        </div>
                     </div>
                  )}

                  {/* ── Passing phase UI ────────────────────────── */}
                  {!roundSummary &&
                     !roundBanner &&
                     !dealingHand &&
                     state.phase === "passing" &&
                     !passTransition && (
                        <Hand
                           cards={state.human_hand}
                           selectedCodes={passSelection}
                           onCardClick={
                              submitting ? undefined : handlePassCardToggle
                           }
                           selectionMode
                        />
                     )}

                  {/* ── Player hand (playing phase) ─────────────── */}
                  {!roundSummary &&
                     !roundBanner &&
                     !dealingHand &&
                     state.phase === "playing" && (
                        <div className={handStyles.handStack}>
                           <div className={handStyles.hand} aria-hidden="true">
                              <div className={handStyles.handCardWrap}>
                                 <div className={handStyles.handSlotEmpty} />
                              </div>
                           </div>
                           {state.human_hand.length > 0 && (
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
                        </div>
                     )}

                  {/* ── Game over screen with score table ───────── */}
                  {state.game_over && !roundSummary && (
                     <GameOverBlock
                        players={state.players}
                        winnerIndex={state.winner_index}
                     />
                  )}
               </div>
            )}
         </PageLayout>
      </>
   );
}
