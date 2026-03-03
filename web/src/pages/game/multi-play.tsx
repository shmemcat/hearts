import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/Buttons";
import {
   ConcedeButton,
   ConcedeModal,
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
   PlayerIcon,
} from "@/components/game";
import type { ShootTheMoonData } from "@/components/game/ShootTheMoonOverlay";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { usePlayQueue, type QueueItem } from "@/hooks/usePlayQueue";
import {
   connectMulti,
   disconnect as disconnectMulti,
   sendPlay as sendMultiPlay,
   sendPass as sendMultiPass,
   sendConcede as sendMultiConcede,
   sendRequestState as sendMultiRequestState,
   onState as onMultiState,
   onPlay as onMultiPlay,
   onTrickComplete as onMultiTrickComplete,
   onPassReceived as onMultiPassReceived,
   onPlayerConceded as onMultiPlayerConceded,
   onIdleWarning as onMultiIdleWarning,
   onGameTerminated as onMultiGameTerminated,
   onGameOver as onMultiGameOver,
   onError as onMultiError,
   onAchievementsUnlocked as onMultiAchievementsUnlocked,
} from "@/lib/multiplayerSocket";
import { reorderSlotsForTableLayout, getShortName } from "@/lib/playUtils";
import type { CurrentTrickSlot, GameState, PlayEvent } from "@/types/game";
import {
   PLAY_PAGE_LAYOUT_CLASS,
   ROUND_BANNER_MS,
   DEAL_HAND_MS,
   PASS_EXIT_MS,
   NO_PASS_HOLD_MS,
} from "@/lib/constants";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/context/AuthContext";
import { useSound } from "@/context/SoundContext";
import { useToast } from "@/context/ToastContext";
import { resolveUnlockId } from "@/lib/achievements";
import { recordGameStats } from "@/lib/gameApi";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import handStyles from "@/components/game/Hand.module.css";
import styles from "@/styles/play.module.css";

const MP_TOKEN_KEY = (gameId: string) => `hearts_mp_token_${gameId}`;
const MP_SEAT_KEY = (gameId: string) => `hearts_mp_seat_${gameId}`;
const MP_LOBBY_KEY = (gameId: string) => `hearts_mp_lobby_${gameId}`;

export default function MultiPlayPage() {
   const [searchParams] = useSearchParams();
   const gameId = searchParams.get("game_id") ?? "";
   const isMobile = useIsMobile();
   const { token: jwtToken } = useAuth();
   const { play: playSound } = useSound();
   const { addToast } = useToast();

   const playerToken = gameId
      ? localStorage.getItem(MP_TOKEN_KEY(gameId))
      : null;
   const savedSeat = gameId ? localStorage.getItem(MP_SEAT_KEY(gameId)) : null;
   const lobbyCode = gameId ? localStorage.getItem(MP_LOBBY_KEY(gameId)) : null;
   const isSpectator = !playerToken;

   // ── Core UI state ──────────────────────────────────────────────────
   const [loading, setLoading] = useState(true);
   const [state, setState] = useState<GameState | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [infoModalOpen, setInfoModalOpen] = useState(false);
   const [concedeModalOpen, setConcedeModalOpen] = useState(false);
   const [conceded, setConceded] = useState(false);
   const [idleKicked, setIdleKicked] = useState(false);
   const [idleWarning, setIdleWarning] = useState(false);
   const [terminated, setTerminated] = useState(false);
   const [passSelection, setPassSelection] = useState<Set<string>>(new Set());
   const [passSubmitted, setPassSubmitted] = useState(false);
   const [roundSummary, setRoundSummary] = useState<{
      deltas: number[];
      round: number;
      players: { name: string; score: number; icon?: string }[];
   } | null>(null);
   const [shootTheMoon, setShootTheMoon] = useState<ShootTheMoonData | null>(
      null
   );
   const [heartsPerPlayer, setHeartsPerPlayer] = useState<number[]>([
      0, 0, 0, 0,
   ]);
   const [heartsVisuallyBroken, setHeartsVisuallyBroken] = useState(false);
   const [noPassHold, setNoPassHold] = useState(false);
   const [roundBanner, setRoundBanner] = useState<{ round: number } | null>(
      null
   );
   const [dealingHand, setDealingHand] = useState(false);
   const [passTransition, setPassTransition] = useState<{
      phase: "exiting" | "gap" | "entering";
      displayHand: string[];
      exitingCodes?: Set<string>;
      exitDir?: "left" | "right" | "up";
      enteringCodes?: Set<string>;
      enterDir?: "left" | "right" | "above";
   } | null>(null);

   const mySeat: number | null =
      state?.my_seat ?? (savedSeat != null ? parseInt(savedSeat, 10) : null);

   // ── Refs ─────────────────────────────────────────────────────────
   const pendingStateRef = useRef<GameState | null>(null);
   const lastHumanCardRef = useRef<string | null>(null);
   const stateRef = useRef(state);
   stateRef.current = state;
   const mySeatRef = useRef(mySeat);
   mySeatRef.current = mySeat;
   const loadingRef = useRef(loading);
   loadingRef.current = loading;
   const prevScoresRef = useRef<number[]>([0, 0, 0, 0]);
   const moonOverlayActiveRef = useRef(false);
   const midRoundMoonShownRef = useRef(false);
   const moonAdjustmentRef = useRef<number[]>([0, 0, 0, 0]);
   const passedCardsRef = useRef<Set<string> | null>(null);
   const prePassHandRef = useRef<string[] | null>(null);
   const passExitDirRef = useRef<"left" | "right" | "up">("left");
   const passEnterDirRef = useRef<"left" | "right" | "above">("right");
   const passExitStartRef = useRef<number>(0);
   const roundEndStateRef = useRef<GameState | null>(null);
   const lastSocketEventRef = useRef<number>(0);
   const concededRef = useRef(conceded);
   concededRef.current = conceded;
   const terminatedRef = useRef(terminated);
   terminatedRef.current = terminated;
   const animationHoldRef = useRef(false);
   animationHoldRef.current = !!(
      roundBanner ||
      dealingHand ||
      noPassHold ||
      roundSummary
   );
   const passTransitionRef = useRef(passTransition);
   passTransitionRef.current = passTransition;
   const pendingRoundEndRef = useRef<GameState | null>(null);
   const eventBufferRef = useRef<QueueItem[]>([]);

   // ── Play queue (animation) ────────────────────────────────────────
   const applyPendingState = useCallback(() => {
      let pending: GameState | null = pendingRoundEndRef.current;
      if (pending) {
         pendingRoundEndRef.current = null;
      } else {
         pending = pendingStateRef.current;
         if (!pending) return;
         pendingStateRef.current = null;
      }

      if (pending.round_just_ended && moonOverlayActiveRef.current) {
         pendingRoundEndRef.current = pending;
         return;
      }

      if (pending.round_just_ended) {
         roundEndStateRef.current = pending;
         const deltas = pending.players.map(
            (p: { score: number }, i: number) =>
               p.score - prevScoresRef.current[i]
         );
         prevScoresRef.current = pending.players.map(
            (p: { score: number }) => p.score
         );
         const currentRound = stateRef.current?.round ?? 1;
         const roundPlayers = pending.players.map(
            (p: { name: string; score: number; icon?: string }) => ({
               name: p.name,
               score: p.score,
               icon: p.icon,
            })
         );

         if (midRoundMoonShownRef.current) {
            midRoundMoonShownRef.current = false;
            setShootTheMoon(null);
         } else {
            const zeroCount = deltas.filter((d: number) => d === 0).length;
            const twentySixCount = deltas.filter(
               (d: number) => d === 26
            ).length;
            if (zeroCount === 1 && twentySixCount === 3) {
               const shooterIdx = deltas.indexOf(0);
               setShootTheMoon({
                  shooterIndex: shooterIdx,
                  deltas,
                  round: currentRound,
                  players: roundPlayers,
               });
            } else {
               setShootTheMoon(null);
            }
         }

         setRoundSummary({
            deltas,
            round: currentRound,
            players: roundPlayers,
         });
         animationHoldRef.current = true;
         return;
      }

      // If we just submitted a pass and the new state has our post-pass hand,
      // run the pass enter animation before applying state.
      const passedSet = passedCardsRef.current;
      const oldHand = prePassHandRef.current;
      const newHand = pending.my_hand ?? pending.human_hand ?? [];

      if (passedSet && oldHand && newHand.length > 0) {
         passedCardsRef.current = null;
         prePassHandRef.current = null;

         const remainingHand = oldHand.filter((c) => !passedSet.has(c));
         const remainingSet = new Set(remainingHand);
         const received = newHand.filter((c: string) => !remainingSet.has(c));
         const receivedSet = new Set(received);

         // Apply state immediately so trick area / turn indicators stay current.
         // The Hand component uses passTransition.displayHand during animation,
         // so the visual pass animation still works independently of game state.
         setState(pending);
         prevScoresRef.current = pending.players.map(
            (p: { score: number }) => p.score
         );
         setPassSubmitted(pending.pass_submitted ?? false);
         if (pending.phase === "passing") {
            resetRef.current();
         }

         const elapsed = Date.now() - passExitStartRef.current;
         const exitRemaining = Math.max(0, PASS_EXIT_MS - elapsed);

         const runGapAndEnter = () => {
            setPassTransition({
               phase: "gap",
               displayHand: remainingHand,
            });

            setTimeout(() => {
               setPassTransition({
                  phase: "entering",
                  displayHand: newHand,
                  enteringCodes: receivedSet,
                  enterDir: passEnterDirRef.current,
               });

               setTimeout(() => {
                  setPassTransition(null);
               }, 1600);
            }, 500);
         };

         if (exitRemaining > 0) {
            setTimeout(runGapAndEnter, exitRemaining);
         } else {
            runGapAndEnter();
         }
         return;
      }

      setState(pending);
      prevScoresRef.current = pending.players.map(
         (p: { score: number }) => p.score
      );
      setPassSubmitted(pending.pass_submitted ?? false);
      setIdleWarning(false);
      if (pending.phase === "passing") {
         resetRef.current();
      }
   }, []);

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

   const resetRef = useRef(reset);
   resetRef.current = reset;

   // ── WebSocket connect / disconnect ─────────────────────────────────
   useEffect(() => {
      if (!gameId) return;
      connectMulti(gameId, playerToken, jwtToken);

      const retryTimer = setTimeout(() => {
         if (loadingRef.current) {
            sendMultiRequestState();
         }
      }, 3000);

      return () => {
         clearTimeout(retryTimer);
         disconnectMulti();
      };
   }, [gameId, playerToken, jwtToken]);

   // ── WebSocket subscriptions ────────────────────────────────────────
   useEffect(() => {
      if (!gameId) return;

      const unsubState = onMultiState((data: GameState) => {
         lastSocketEventRef.current = Date.now();
         if (loadingRef.current) {
            setLoading(false);
            setState(data);
            prevScoresRef.current = data.players.map(
               (p: { score: number }) => p.score
            );
            setPassSubmitted(data.pass_submitted ?? false);
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
            setRoundBanner({ round: data.round });
            animationHoldRef.current = true;
            return;
         }
         if (data.round_just_ended) {
            pendingRoundEndRef.current = data;
         } else {
            pendingStateRef.current = data;
         }
         if (!isActive() && !animationHoldRef.current) {
            applyPendingRef.current();
         }
      });

      const unsubPlay = onMultiPlay((ev: PlayEvent) => {
         lastSocketEventRef.current = Date.now();
         const seat = mySeatRef.current;
         const isOwnEcho =
            seat !== null &&
            ev.player_index === seat &&
            ev.card === lastHumanCardRef.current;
         if (isOwnEcho) {
            lastHumanCardRef.current = null;
            return;
         }
         if (animationHoldRef.current || passTransitionRef.current) {
            eventBufferRef.current.push({ type: "play", event: ev });
         } else {
            enqueue({ type: "play", event: ev });
         }
      });

      const unsubTrick = onMultiTrickComplete(() => {
         lastSocketEventRef.current = Date.now();
         if (animationHoldRef.current || passTransitionRef.current) {
            eventBufferRef.current.push({ type: "trick_complete" });
         } else {
            enqueue({ type: "trick_complete" });
         }
      });

      const unsubPassReceived = onMultiPassReceived(() => {
         setPassSubmitted(true);
      });

      const unsubConceded = onMultiPlayerConceded((data) => {
         const seat = mySeatRef.current;
         if (
            seat !== null &&
            data.seat_index === seat &&
            data.reason === "idle"
         ) {
            setConceded(true);
            setIdleKicked(true);
            setIdleWarning(false);
            // Don't remove localStorage here -- playerToken is a dependency
            // of the connect effect, so changing it would trigger a socket
            // reconnect and drop the game_terminated event that follows.
            // The game_terminated handler handles localStorage cleanup.
         }
      });

      const unsubIdleWarning = onMultiIdleWarning(() => {
         setIdleWarning(true);
      });

      const unsubTerminated = onMultiGameTerminated(() => {
         setTerminated(true);
         localStorage.removeItem(MP_TOKEN_KEY(gameId));
         localStorage.removeItem(MP_SEAT_KEY(gameId));
      });

      const unsubGameOver = onMultiGameOver((data: GameState) => {
         setState(data);
         localStorage.removeItem(MP_TOKEN_KEY(gameId));
         localStorage.removeItem(MP_SEAT_KEY(gameId));
      });

      const unsubError = onMultiError((msg: string) => {
         setError(msg);
      });

      const unsubAchievements = onMultiAchievementsUnlocked((data) => {
         for (const unlockId of data.newly_unlocked) {
            const info = resolveUnlockId(unlockId);
            if (info) {
               addToast({
                  achievementId: unlockId,
                  name: info.name,
                  icon: <FontAwesomeIcon icon={info.def.icon} />,
                  tier: info.tier,
               });
            }
         }
      });

      return () => {
         unsubState();
         unsubPlay();
         unsubTrick();
         unsubPassReceived();
         unsubConceded();
         unsubIdleWarning();
         unsubTerminated();
         unsubGameOver();
         unsubError();
         unsubAchievements();
      };
   }, [gameId, enqueue, isActive, setSlots, addToast]);

   // ── Watchdog: nudge server if game appears stuck ──────────────────
   useEffect(() => {
      if (!gameId) return;
      const STALL_THRESHOLD_MS = 10_000;
      const CHECK_INTERVAL_MS = 5_000;

      const id = setInterval(() => {
         const s = stateRef.current;
         if (!s || s.game_over) return;
         if (loadingRef.current) return;
         if (concededRef.current || terminatedRef.current) return;

         const elapsed = Date.now() - lastSocketEventRef.current;
         if (elapsed < STALL_THRESHOLD_MS) return;

         const seat = mySeatRef.current;
         const isMyTurn =
            s.phase === "playing" && seat !== null && s.whose_turn === seat;
         if (isMyTurn) return;

         sendMultiRequestState();
         lastSocketEventRef.current = Date.now();
      }, CHECK_INTERVAL_MS);

      return () => clearInterval(id);
   }, [gameId]);

   // ── Flush buffered events when animation hold ends ────────────────
   useEffect(() => {
      if (
         roundBanner ||
         dealingHand ||
         noPassHold ||
         passTransition ||
         roundSummary
      )
         return;
      const buffered = eventBufferRef.current;
      if (buffered.length > 0) {
         eventBufferRef.current = [];
         for (const item of buffered) {
            enqueue(item);
         }
      }
      if (!isActive()) {
         applyPendingRef.current();
      }
   }, [
      roundBanner,
      dealingHand,
      noPassHold,
      passTransition,
      roundSummary,
      enqueue,
      isActive,
   ]);

   // ── Round banner + dealing animation ──────────────────────────────
   const handleContinueRoundRef = useRef<() => void>(() => {});

   useEffect(() => {
      if (!roundBanner) return;
      const t = setTimeout(() => {
         setRoundBanner(null);
         const s = stateRef.current;
         if (s?.pass_direction === "none") {
            setNoPassHold(true);
            setTimeout(() => setNoPassHold(false), NO_PASS_HOLD_MS);
         } else {
            setDealingHand(true);
            setTimeout(() => setDealingHand(false), DEAL_HAND_MS);
         }
      }, ROUND_BANNER_MS);
      return () => clearTimeout(t);
   }, [roundBanner]);

   // ── Track hearts per player from trick results ──────────────────
   useEffect(() => {
      if (trickResult && trickResult.hearts > 0) {
         setHeartsPerPlayer((prev) => {
            const next = [...prev];
            next[trickResult.winner] += trickResult.hearts;
            return next;
         });
      }
   }, [trickResult]);

   // ── Track when hearts are visually broken ──────────────────────
   useEffect(() => {
      const hasHeart = displaySlots.some(
         (s) => s && s.card.toLowerCase().endsWith("h")
      );
      if (hasHeart) setHeartsVisuallyBroken(true);
   }, [displaySlots]);

   // ── Sound effects ────────────────────────────────────────────────
   const playSoundRef = useRef(playSound);
   playSoundRef.current = playSound;

   useEffect(() => {
      if (roundBanner) playSoundRef.current("heartDelta");
   }, [roundBanner]);

   const prevHeartsVisuallyBrokenRef = useRef(false);
   useEffect(() => {
      if (heartsVisuallyBroken && !prevHeartsVisuallyBrokenRef.current) {
         playSoundRef.current("heartsBroken");
      }
      prevHeartsVisuallyBrokenRef.current = heartsVisuallyBroken;
   }, [heartsVisuallyBroken]);

   useEffect(() => {
      if (dealingHand) playSoundRef.current("cardFan");
   }, [dealingHand]);

   const prevSlotsRef = useRef(displaySlots);
   useEffect(() => {
      const prev = prevSlotsRef.current;
      const appeared = displaySlots.some(
         (s, i) => s != null && prev[i] == null
      );
      prevSlotsRef.current = displaySlots;
      if (appeared) playSoundRef.current("cardSlide");
   }, [displaySlots]);

   useEffect(() => {
      if (collectTarget != null) playSoundRef.current("cardSweep");
   }, [collectTarget]);

   useEffect(() => {
      if (trickResult && trickResult.hearts > 0)
         playSoundRef.current("heartDelta");
   }, [trickResult]);

   useEffect(() => {
      if (roundSummary) playSoundRef.current("roundEnd");
   }, [roundSummary]);

   const gameOverSoundRef = useRef(false);
   useEffect(() => {
      if (state?.game_over && !gameOverSoundRef.current) {
         gameOverSoundRef.current = true;
         playSoundRef.current("gameEnd");
      }
   }, [state?.game_over]);

   // ── Record stats via HTTP when game ends (fallback for socket auth) ──
   const statsRecordedRef = useRef(false);
   useEffect(() => {
      if (
         !state?.game_over ||
         statsRecordedRef.current ||
         !jwtToken ||
         !gameId ||
         mySeat === null ||
         conceded
      )
         return;
      statsRecordedRef.current = true;
      const myScore = state.players[mySeat]?.score ?? 0;
      const won = state.winner_index === mySeat;
      recordGameStats(jwtToken, {
         game_id: gameId,
         final_score: myScore,
         won,
         moon_shots: state.human_moon_shots ?? 0,
         round_count: state.round,
         all_scores: state.players.map((p) => p.score),
         hearts_broken_count: state.human_hearts_broken ?? 0,
         difficulty: "multiplayer",
      }).then((res) => {
         if (!res.ok) return;
         const { newly_unlocked } = res.data;
         for (const unlockId of newly_unlocked) {
            const info = resolveUnlockId(unlockId);
            if (info) {
               addToast({
                  achievementId: unlockId,
                  name: info.name,
                  icon: <FontAwesomeIcon icon={info.def.icon} />,
                  tier: info.tier,
               });
            }
         }
      });
   }, [
      state?.game_over,
      state?.winner_index,
      state?.players,
      state?.human_moon_shots,
      state?.human_hearts_broken,
      state?.round,
      jwtToken,
      gameId,
      mySeat,
      conceded,
      addToast,
   ]);

   useEffect(() => {
      if (
         passTransition?.phase === "exiting" ||
         passTransition?.phase === "entering"
      ) {
         playSoundRef.current("cardSweep");
      }
   }, [passTransition?.phase]);

   // ── Round summary continue ───────────────────────────────────────
   handleContinueRoundRef.current = () => {
      setRoundSummary(null);
      setShootTheMoon(null);
      moonOverlayActiveRef.current = false;
      const nextState = roundEndStateRef.current ?? pendingStateRef.current;
      roundEndStateRef.current = null;
      pendingStateRef.current = null;
      if (nextState) {
         setState(nextState);
         prevScoresRef.current = nextState.players.map(
            (p: { score: number }) => p.score
         );
         setPassSubmitted(nextState.pass_submitted ?? false);
      }
      const nextRound =
         nextState?.round ?? (state?.round ? state.round + 1 : 1);
      setRoundBanner({ round: nextRound });
      animationHoldRef.current = true;
      setHeartsPerPlayer([0, 0, 0, 0]);
      setHeartsVisuallyBroken(false);
      setPassSelection(new Set());
      setPassSubmitted(false);
      resetRef.current();
   };

   // ── Pass handler ──────────────────────────────────────────────────
   const handleConfirmPass = useCallback(() => {
      if (passSelection.size !== 3 || isSpectator || conceded) return;
      const currentState = stateRef.current;
      if (!currentState) return;

      const passDir = currentState.pass_direction;
      const exitDir: "left" | "right" | "up" =
         passDir === "left" ? "left" : passDir === "right" ? "right" : "up";
      const enterDir: "left" | "right" | "above" =
         passDir === "left" ? "right" : passDir === "right" ? "left" : "above";

      const oldHand = [
         ...(currentState.my_hand ?? currentState.human_hand ?? []),
      ];
      const passedSet = new Set(passSelection);
      const cards = Array.from(passSelection);

      passedCardsRef.current = passedSet;
      prePassHandRef.current = oldHand;
      passExitDirRef.current = exitDir;
      passEnterDirRef.current = enterDir;

      setPassSelection(new Set());

      passExitStartRef.current = Date.now();

      setPassTransition({
         phase: "exiting",
         displayHand: oldHand,
         exitingCodes: passedSet,
         exitDir,
      });

      sendMultiPass(cards);
      setPassSubmitted(true);
      setIdleWarning(false);
   }, [passSelection, isSpectator, conceded]);

   // ── Card click handler ────────────────────────────────────────────
   const handleCardClick = useCallback(
      (code: string) => {
         if (!state || isSpectator || conceded) return;

         if (state.phase === "passing" && !passSubmitted) {
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
            return;
         }
         if (state.phase !== "playing" || state.game_over) return;
         if (state.whose_turn !== mySeat) return;
         if (!state.legal_plays.includes(code)) return;

         showImmediately({
            player_index: mySeat!,
            card: code,
         });
         lastHumanCardRef.current = code;

         setState((prev) =>
            prev
               ? {
                    ...prev,
                    my_hand: (prev.my_hand ?? prev.human_hand)?.filter(
                       (c: string) => c !== code
                    ),
                    human_hand: (prev.human_hand ?? prev.my_hand)?.filter(
                       (c: string) => c !== code
                    ),
                    legal_plays: [],
                 }
               : prev
         );

         sendMultiPlay(code);
         setIdleWarning(false);
      },
      [state, isSpectator, conceded, passSubmitted, mySeat, showImmediately]
   );

   // ── Concede handler ───────────────────────────────────────────────
   const handleConcede = useCallback(() => {
      setConcedeModalOpen(false);
      setConceded(true);
      sendMultiConcede((ack) => {
         if (ack?.status === "terminated") {
            setTerminated(true);
         }
         if (gameId) {
            localStorage.removeItem(MP_TOKEN_KEY(gameId));
            localStorage.removeItem(MP_SEAT_KEY(gameId));
         }
      });
   }, [gameId]);

   // ── Early returns ─────────────────────────────────────────────────
   if (!gameId) {
      return (
         <>
            <Helmet>
               <title>Multiplayer | Hearts</title>
            </Helmet>
            <PageLayout
               title="MULTIPLAYER"
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
               <title>Multiplayer | Hearts</title>
            </Helmet>
            <PageLayout
               title="MULTIPLAYER"
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

   if (error && !state) {
      return (
         <>
            <Helmet>
               <title>Multiplayer | Hearts</title>
            </Helmet>
            <PageLayout
               title="MULTIPLAYER"
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
   const whoseTurn = busy ? currentTurn : state?.whose_turn ?? null;
   const slots = displaySlots;
   const myHand = state?.my_hand ?? state?.human_hand ?? [];
   const legalPlays = state?.legal_plays ?? [];
   const showPassUI =
      state?.phase === "passing" && !passSubmitted && !isSpectator && !conceded;
   const effectiveMySeat = mySeat ?? 0;

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

   // ── Phase hint text ───────────────────────────────────────────────
   let phaseHintText = "";
   if (isSpectator || conceded) {
      phaseHintText = isMobile ? "" : "Spectating";
   } else if (state?.game_over) {
      phaseHintText = "";
   } else if (noPassHold) {
      phaseHintText = "No passing this round";
   } else if (state?.phase === "passing") {
      if (passSubmitted) {
         phaseHintText = "Waiting for other players...";
      } else {
         phaseHintText = `Select 3 cards to pass ${state.pass_direction}`;
      }
   } else if (state?.phase === "playing") {
      const effectiveTurn = whoseTurn ?? state.whose_turn;
      if (effectiveTurn === mySeat) {
         phaseHintText = "Your turn!";
      } else {
         const turnPlayer = state.players[effectiveTurn]?.name ?? "";
         phaseHintText = `${turnPlayer}'s turn`;
      }
   }

   // ── Seat ordering: rotate so my seat is at bottom ─────────────────
   const rawPlayers = state?.players ?? [];
   const orderedPlayers = reorderSlotsForTableLayout(
      [...rawPlayers],
      effectiveMySeat
   );
   // Trick TABLE_SLOT_ORDER expects [bottom, left, top, right].
   // A simple rotation by mySeat produces that order directly, unlike
   // reorderSlotsForTableLayout which swaps left/top for GameSeat indexing.
   const trickSlots: typeof slots = [
      slots[(0 + effectiveMySeat) % 4],
      slots[(1 + effectiveMySeat) % 4],
      slots[(2 + effectiveMySeat) % 4],
      slots[(3 + effectiveMySeat) % 4],
   ];
   const mappedCollectTarget =
      collectTarget != null ? (collectTarget - effectiveMySeat + 4) % 4 : null;
   const orderedIndices = reorderSlotsForTableLayout(
      [0, 1, 2, 3],
      effectiveMySeat
   );

   // ── Main render ────────────────────────────────────────────────────
   return (
      <>
         <Helmet>
            <title>Multiplayer | Hearts</title>
         </Helmet>
         <PageLayout
            title="MULTIPLAYER"
            hideTitleBlock
            className={PLAY_PAGE_LAYOUT_CLASS}
         >
            {idleWarning && (
               <div className={styles.idleWarningBanner}>
                  You&apos;ll be removed for inactivity in 1 minute. Make a move
                  to stay in the game.
               </div>
            )}
            {state && (
               <div className={styles.playContent}>
                  {!roundSummary && !isMobile && (
                     <div className={styles.topBar}>
                        <InfoPill
                           round={state.round}
                           passDirection={state.pass_direction}
                           difficulty={state.difficulty}
                           difficultyPrefix={
                              state.difficulty ? "Bots" : undefined
                           }
                        />
                        {!state.game_over && !conceded && !isSpectator && (
                           <ConcedeButton
                              onClick={() => setConcedeModalOpen(true)}
                           />
                        )}
                     </div>
                  )}
                  {!roundSummary && isMobile && (
                     <InfoButton onClick={() => setInfoModalOpen(true)} />
                  )}
                  {infoModalOpen && isMobile && (
                     <InfoModal
                        round={state.round}
                        passDirection={state.pass_direction}
                        difficulty={state.difficulty}
                        difficultyPrefix={state.difficulty ? "Bots" : undefined}
                        players={state.players}
                        mySeatIndex={conceded || isSpectator ? -1 : mySeat ?? 0}
                        onClose={() => setInfoModalOpen(false)}
                        onConcede={() => setConcedeModalOpen(true)}
                        gameOver={state.game_over || conceded || isSpectator}
                     />
                  )}
                  {concedeModalOpen && (
                     <ConcedeModal
                        onClose={() => setConcedeModalOpen(false)}
                        onConcede={handleConcede}
                     />
                  )}

                  <div className={styles.gameTableWrapper}>
                     {isMobile ? (
                        <MobileGameTable
                           seats={[
                              {
                                 name:
                                    orderedPlayers[0]?.name ??
                                    (isSpectator ? "Host" : "You"),
                                 shortName: getShortName(
                                    orderedPlayers[0]?.name ?? "You"
                                 ),
                                 seatIndex: orderedIndices[0],
                                 score: seatScore(orderedIndices[0]),
                                 position: "bottom" as const,
                                 isCurrentTurn: seatIsCurrentTurn(
                                    orderedIndices[0]
                                 ),
                                 showHearts: !!showHeartsOnSeats,
                                 heartCount:
                                    heartsPerPlayer[orderedIndices[0]] ?? 0,
                                 icon: orderedPlayers[0]?.icon,
                              },
                              {
                                 name: orderedPlayers[1]?.name ?? "—",
                                 shortName: getShortName(
                                    orderedPlayers[1]?.name ?? "—"
                                 ),
                                 seatIndex: orderedIndices[1],
                                 score: seatScore(orderedIndices[1]),
                                 position: "top" as const,
                                 isCurrentTurn: seatIsCurrentTurn(
                                    orderedIndices[1]
                                 ),
                                 showHearts: !!showHeartsOnSeats,
                                 heartCount:
                                    heartsPerPlayer[orderedIndices[1]] ?? 0,
                                 icon: orderedPlayers[1]?.icon,
                              },
                              {
                                 name: orderedPlayers[2]?.name ?? "—",
                                 shortName: getShortName(
                                    orderedPlayers[2]?.name ?? "—"
                                 ),
                                 seatIndex: orderedIndices[2],
                                 score: seatScore(orderedIndices[2]),
                                 position: "left" as const,
                                 isCurrentTurn: seatIsCurrentTurn(
                                    orderedIndices[2]
                                 ),
                                 showHearts: !!showHeartsOnSeats,
                                 heartCount:
                                    heartsPerPlayer[orderedIndices[2]] ?? 0,
                                 icon: orderedPlayers[2]?.icon,
                              },
                              {
                                 name: orderedPlayers[3]?.name ?? "—",
                                 shortName: getShortName(
                                    orderedPlayers[3]?.name ?? "—"
                                 ),
                                 seatIndex: orderedIndices[3],
                                 score: seatScore(orderedIndices[3]),
                                 position: "right" as const,
                                 isCurrentTurn: seatIsCurrentTurn(
                                    orderedIndices[3]
                                 ),
                                 showHearts: !!showHeartsOnSeats,
                                 heartCount:
                                    heartsPerPlayer[orderedIndices[3]] ?? 0,
                                 icon: orderedPlayers[3]?.icon,
                              },
                           ]}
                           trickSlots={trickSlots}
                           collectTarget={mappedCollectTarget}
                           playerNames={reorderSlotsForTableLayout(
                              (state?.players ?? []).map((p) => p.name),
                              effectiveMySeat
                           )}
                           centerIcon={
                              !roundSummary && state.phase === "playing" ? (
                                 <HeartIcon
                                    size={40}
                                    color={
                                       heartsVisuallyBroken
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
                           {/* Top (across from me) */}
                           <GameSeat
                              name={orderedPlayers[1]?.name ?? "—"}
                              shortName={getShortName(
                                 orderedPlayers[1]?.name ?? "—"
                              )}
                              seatIndex={orderedIndices[1]}
                              score={seatScore(orderedIndices[1])}
                              isCurrentTurn={seatIsCurrentTurn(
                                 orderedIndices[1]
                              )}
                              position="top"
                              showHearts={!!showHeartsOnSeats}
                              heartCount={
                                 heartsPerPlayer[orderedIndices[1]] ?? 0
                              }
                              icon={orderedPlayers[1]?.icon}
                           />
                           {/* Left */}
                           <GameSeat
                              name={orderedPlayers[2]?.name ?? "—"}
                              shortName={getShortName(
                                 orderedPlayers[2]?.name ?? "—"
                              )}
                              seatIndex={orderedIndices[2]}
                              score={seatScore(orderedIndices[2])}
                              isCurrentTurn={seatIsCurrentTurn(
                                 orderedIndices[2]
                              )}
                              position="left"
                              showHearts={!!showHeartsOnSeats}
                              heartCount={
                                 heartsPerPlayer[orderedIndices[2]] ?? 0
                              }
                              icon={orderedPlayers[2]?.icon}
                           />
                           {/* Center: trick */}
                           <div className={styles.tableCenter}>
                              <Trick
                                 layout="table"
                                 slots={trickSlots}
                                 collectTarget={mappedCollectTarget}
                                 playerNames={reorderSlotsForTableLayout(
                                    (state?.players ?? []).map((p) => p.name),
                                    effectiveMySeat
                                 )}
                                 centerIcon={
                                    !roundSummary &&
                                    state.phase === "playing" ? (
                                       <HeartIcon
                                          size={40}
                                          color={
                                             heartsVisuallyBroken
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
                           {/* Right */}
                           <GameSeat
                              name={orderedPlayers[3]?.name ?? "—"}
                              shortName={getShortName(
                                 orderedPlayers[3]?.name ?? "—"
                              )}
                              seatIndex={orderedIndices[3]}
                              score={seatScore(orderedIndices[3])}
                              isCurrentTurn={seatIsCurrentTurn(
                                 orderedIndices[3]
                              )}
                              position="right"
                              showHearts={!!showHeartsOnSeats}
                              heartCount={
                                 heartsPerPlayer[orderedIndices[3]] ?? 0
                              }
                              icon={orderedPlayers[3]?.icon}
                           />
                           {/* Bottom (me) */}
                           <GameSeat
                              name={
                                 orderedPlayers[0]?.name ??
                                 (isSpectator ? "Host" : "You")
                              }
                              shortName={getShortName(
                                 orderedPlayers[0]?.name ??
                                    (isSpectator ? "Host" : "You")
                              )}
                              seatIndex={orderedIndices[0]}
                              score={seatScore(orderedIndices[0])}
                              isCurrentTurn={seatIsCurrentTurn(
                                 orderedIndices[0]
                              )}
                              position="bottom"
                              showHearts={!!showHeartsOnSeats}
                              heartCount={
                                 heartsPerPlayer[orderedIndices[0]] ?? 0
                              }
                              icon={orderedPlayers[0]?.icon}
                           />
                        </div>
                     )}

                     {/* ── Centered pass button in table ──────────── */}
                     {!roundBanner &&
                        !dealingHand &&
                        showPassUI &&
                        !passTransition && (
                           <div className={styles.passCenter}>
                              <Button
                                 name="Submit Pass"
                                 disabled={passSelection.size !== 3}
                                 onClick={handleConfirmPass}
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
                                 <span>pass</span>
                                 <span>{state?.pass_direction ?? ""}</span>
                              </Button>
                           </div>
                        )}

                     {/* Waiting for other players */}
                     {!roundBanner &&
                        !dealingHand &&
                        state?.phase === "passing" &&
                        passSubmitted &&
                        !passTransition &&
                        !isSpectator &&
                        !conceded && (
                           <div className={styles.passCenter}>
                              <p
                                 className="text-sm opacity-70"
                                 style={{
                                    background: "var(--bg)",
                                    padding: "8px 16px",
                                    borderRadius: "8px",
                                 }}
                              >
                                 Waiting for other players...
                              </p>
                           </div>
                        )}

                     {/* Round banner (start-of-round) */}
                     {roundBanner && !roundSummary && (
                        <div className={styles.roundBannerOverlay}>
                           <span className={styles.roundBannerText}>
                              Round {roundBanner.round}
                           </span>
                        </div>
                     )}
                  </div>

                  <div className={styles.phaseHint}>
                     <PhaseHint
                        text={
                           roundSummary || roundBanner || dealingHand
                              ? null
                              : phaseHintText
                        }
                     />
                  </div>

                  {/* Hand */}
                  {!isSpectator && !conceded && (
                     <div
                        className={`${handStyles.handWrapper} ${
                           dealingHand ? handStyles.dealingHand : ""
                        }`}
                        style={
                           myHand.length === 0 && !passTransition
                              ? { visibility: "hidden" }
                              : undefined
                        }
                     >
                        {myHand.length > 0 || passTransition ? (
                           <Hand
                              cards={
                                 passTransition
                                    ? passTransition.displayHand
                                    : myHand
                              }
                              legalCodes={
                                 showPassUI
                                    ? undefined
                                    : state?.phase === "playing" &&
                                      state.whose_turn === mySeat
                                    ? new Set(legalPlays)
                                    : new Set<string>()
                              }
                              selectedCodes={
                                 showPassUI ? passSelection : undefined
                              }
                              selectionMode={showPassUI}
                              onCardClick={handleCardClick}
                              exitingCodes={passTransition?.exitingCodes}
                              exitDirection={passTransition?.exitDir}
                              enteringCodes={passTransition?.enteringCodes}
                              enterDirection={passTransition?.enterDir}
                           />
                        ) : (
                           <div className={handStyles.hand} aria-hidden="true">
                              <div className={handStyles.handCardWrap}>
                                 <div className={handStyles.handSlotEmpty} />
                              </div>
                           </div>
                        )}
                     </div>
                  )}

                  {/* Spectator hand placeholder */}
                  {(isSpectator || conceded) && (
                     <div className={handStyles.handWrapper}>
                        <p
                           className="text-sm opacity-60"
                           style={{ padding: "20px 0" }}
                        >
                           {idleKicked
                              ? "You were removed for inactivity."
                              : conceded
                              ? "You are spectating after conceding."
                              : "Spectating — enjoy the show!"}
                        </p>
                     </div>
                  )}

                  {/* Game over modal */}
                  {state?.game_over && !terminated && (
                     <GameOverBlock
                        players={state.players}
                        winnerIndex={state.winner_index}
                        mySeatIndex={conceded || isSpectator ? -1 : mySeat ?? 0}
                     >
                        <ButtonGroup>
                           {lobbyCode && (
                              <Link to={`/game/lobby/${lobbyCode}`}>
                                 <Button
                                    name="Play Again"
                                    style={{ width: "250px" }}
                                 />
                              </Link>
                           )}
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
                     </GameOverBlock>
                  )}
               </div>
            )}
         </PageLayout>

         {/* Round summary overlay */}
         {roundSummary && (
            <RoundSummaryOverlay
               summary={roundSummary}
               mySeatIndex={conceded || isSpectator ? -1 : mySeat ?? 0}
               onContinue={() => handleContinueRoundRef.current()}
            />
         )}

         {/* Shoot the moon overlay */}
         {shootTheMoon && (
            <ShootTheMoonOverlay
               shooterIndex={shootTheMoon.shooterIndex}
               deltas={shootTheMoon.deltas}
               players={shootTheMoon.players}
               round={shootTheMoon.round}
               onContinue={() => {
                  moonOverlayActiveRef.current = false;
                  setShootTheMoon(null);
               }}
            />
         )}

         {/* Game terminated */}
         {terminated && (
            <div className={styles.gameOverBackdrop}>
               <div className={styles.gameOverBlock}>
                  <p className={styles.gameOverTitle}>Game Terminated</p>
                  <p className="text-sm opacity-80">
                     All players have left the game.
                  </p>
                  {state && (
                     <table className={styles.scoreTable}>
                        <thead>
                           <tr>
                              <th>Player</th>
                              <th>Score</th>
                           </tr>
                        </thead>
                        <tbody>
                           {[...state.players]
                              .map((p, i) => ({ ...p, idx: i }))
                              .sort((a, b) => a.score - b.score)
                              .map((p) => (
                                 <tr
                                    key={p.idx}
                                    className={
                                       !conceded &&
                                       !isSpectator &&
                                       p.idx === (mySeat ?? 0)
                                          ? styles.scoreTableMe
                                          : ""
                                    }
                                 >
                                    <td>
                                       <PlayerIcon
                                          name={p.name}
                                          icon={p.icon}
                                          size={13}
                                       />{" "}
                                       {p.name}
                                    </td>
                                    <td>{p.score}</td>
                                 </tr>
                              ))}
                        </tbody>
                     </table>
                  )}
                  <ButtonGroup>
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
               </div>
            </div>
         )}
      </>
   );
}
