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
} from "@/components/game";
import type { ShootTheMoonData } from "@/components/game/ShootTheMoonOverlay";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { usePlayQueue } from "@/hooks/usePlayQueue";
import {
   connectMulti,
   disconnect as disconnectMulti,
   sendPlay as sendMultiPlay,
   sendPass as sendMultiPass,
   sendConcede as sendMultiConcede,
   onState as onMultiState,
   onPlay as onMultiPlay,
   onTrickComplete as onMultiTrickComplete,
   onPassReceived as onMultiPassReceived,
   onPlayerConceded as onMultiPlayerConceded,
   onGameTerminated as onMultiGameTerminated,
   onGameOver as onMultiGameOver,
   onError as onMultiError,
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
import { useSound } from "@/context/SoundContext";
import handStyles from "@/components/game/Hand.module.css";
import styles from "@/styles/play.module.css";

const MP_TOKEN_KEY = (gameId: string) => `hearts_mp_token_${gameId}`;
const MP_SEAT_KEY = (gameId: string) => `hearts_mp_seat_${gameId}`;

export default function MultiPlayPage() {
   const [searchParams] = useSearchParams();
   const gameId = searchParams.get("game_id") ?? "";
   const isMobile = useIsMobile();
   const { play: playSound } = useSound();

   const playerToken = gameId
      ? localStorage.getItem(MP_TOKEN_KEY(gameId))
      : null;
   const savedSeat = gameId ? localStorage.getItem(MP_SEAT_KEY(gameId)) : null;
   const isSpectator = !playerToken;

   // ── Core UI state ──────────────────────────────────────────────────
   const [loading, setLoading] = useState(true);
   const [state, setState] = useState<GameState | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [infoModalOpen, setInfoModalOpen] = useState(false);
   const [concedeModalOpen, setConcedeModalOpen] = useState(false);
   const [conceded, setConceded] = useState(false);
   const [terminated, setTerminated] = useState(false);
   const [passSelection, setPassSelection] = useState<Set<string>>(new Set());
   const [passSubmitted, setPassSubmitted] = useState(false);
   const [roundSummary, setRoundSummary] = useState<{
      deltas: number[];
      round: number;
      players: { name: string; score: number }[];
   } | null>(null);
   const [shootTheMoon, setShootTheMoon] = useState<ShootTheMoonData | null>(
      null
   );
   const [heartsPerPlayer, setHeartsPerPlayer] = useState<number[]>([
      0, 0, 0, 0,
   ]);
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
   const prevScoresRef = useRef<number[]>([0, 0, 0, 0]);
   const moonOverlayActiveRef = useRef(false);
   const midRoundMoonShownRef = useRef(false);
   const moonAdjustmentRef = useRef<number[]>([0, 0, 0, 0]);

   // ── Play queue (animation) ────────────────────────────────────────
   const applyPendingState = useCallback(() => {
      const pending = pendingStateRef.current;
      if (!pending) return;
      if (pending.round_just_ended && moonOverlayActiveRef.current) return;
      pendingStateRef.current = null;

      if (pending.round_just_ended) {
         const deltas = pending.players.map(
            (p: { score: number }, i: number) =>
               p.score - prevScoresRef.current[i]
         );
         prevScoresRef.current = pending.players.map(
            (p: { score: number }) => p.score
         );
         const currentRound = stateRef.current?.round ?? 1;
         const roundPlayers = pending.players.map(
            (p: { name: string; score: number }) => ({
               name: p.name,
               score: p.score,
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
         return;
      }

      setState(pending);
      prevScoresRef.current = pending.players.map(
         (p: { score: number }) => p.score
      );
      setPassSubmitted(pending.pass_submitted ?? false);
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
      connectMulti(gameId, playerToken);
      return () => disconnectMulti();
   }, [gameId, playerToken]);

   // ── WebSocket subscriptions ────────────────────────────────────────
   useEffect(() => {
      const unsubState = onMultiState((data: GameState) => {
         if (loading) {
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
            return;
         }
         pendingStateRef.current = data;
         if (!isActive()) {
            applyPendingRef.current();
         }
      });

      const unsubPlay = onMultiPlay((ev: PlayEvent) => {
         if (
            mySeat !== null &&
            ev.player_index === mySeat &&
            ev.card === lastHumanCardRef.current
         ) {
            lastHumanCardRef.current = null;
            return;
         }
         enqueue({ type: "play", event: ev });
      });

      const unsubTrick = onMultiTrickComplete(() => {
         enqueue({ type: "trick_complete" });
      });

      const unsubPassReceived = onMultiPassReceived(() => {
         setPassSubmitted(true);
      });

      const unsubConceded = onMultiPlayerConceded(() => {
         // State update will come via next state emission
      });

      const unsubTerminated = onMultiGameTerminated(() => {
         setTerminated(true);
      });

      const unsubGameOver = onMultiGameOver((data: GameState) => {
         setState(data);
         if (gameId) {
            localStorage.removeItem(MP_TOKEN_KEY(gameId));
            localStorage.removeItem(MP_SEAT_KEY(gameId));
         }
      });

      const unsubError = onMultiError((msg: string) => {
         setError(msg);
      });

      return () => {
         unsubState();
         unsubPlay();
         unsubTrick();
         unsubPassReceived();
         unsubConceded();
         unsubTerminated();
         unsubGameOver();
         unsubError();
      };
   }, [gameId, mySeat, loading, enqueue, isActive, setSlots]);

   // ── Round banner + dealing animation ──────────────────────────────
   const handleContinueRoundRef = useRef<() => void>(() => {});

   useEffect(() => {
      if (!roundBanner || !state) return;
      const t = setTimeout(() => {
         setRoundBanner(null);
         if (state.phase === "passing" && state.pass_direction === "none") {
            setNoPassHold(true);
            setTimeout(() => setNoPassHold(false), NO_PASS_HOLD_MS);
         } else {
            setDealingHand(true);
            setTimeout(() => setDealingHand(false), DEAL_HAND_MS);
         }
      }, ROUND_BANNER_MS);
      return () => clearTimeout(t);
   }, [roundBanner, state?.phase, state?.pass_direction, state]);

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

   // ── Sound effects for trick sweep and heart deltas ─────────────
   const playSoundRef = useRef(playSound);
   playSoundRef.current = playSound;

   useEffect(() => {
      if (collectTarget != null) playSoundRef.current("cardSweep");
   }, [collectTarget]);

   useEffect(() => {
      if (trickResult && trickResult.hearts > 0)
         playSoundRef.current("heartDelta");
   }, [trickResult]);

   // ── Round summary continue ───────────────────────────────────────
   handleContinueRoundRef.current = () => {
      setRoundSummary(null);
      setShootTheMoon(null);
      moonOverlayActiveRef.current = false;
      const pending = pendingStateRef.current;
      if (pending) {
         pendingStateRef.current = null;
         setState(pending);
         prevScoresRef.current = pending.players.map(
            (p: { score: number }) => p.score
         );
         setPassSubmitted(pending.pass_submitted ?? false);
      }
      setRoundBanner({ round: state?.round ? state.round + 1 : 1 });
      setPassSelection(new Set());
      setPassSubmitted(false);
      resetRef.current();
   };

   // ── Pass handler ──────────────────────────────────────────────────
   const handleConfirmPass = useCallback(() => {
      if (passSelection.size !== 3 || isSpectator || conceded) return;
      const cards = Array.from(passSelection);
      sendMultiPass(cards);
      setPassSubmitted(true);
      setPassSelection(new Set());
   }, [passSelection, isSpectator, conceded]);

   // ── Card click handler ────────────────────────────────────────────
   const handleCardClick = useCallback(
      (code: string) => {
         if (!state || isSpectator || conceded) return;

         if (state.phase === "passing" && !passSubmitted) {
            setPassSelection((prev) => {
               const next = new Set(prev);
               if (next.has(code)) next.delete(code);
               else if (next.size < 3) next.add(code);
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
      },
      [state, isSpectator, conceded, passSubmitted, mySeat, showImmediately]
   );

   // ── Concede handler ───────────────────────────────────────────────
   const handleConcede = useCallback(() => {
      sendMultiConcede();
      setConcedeModalOpen(false);
      setConceded(true);
   }, []);

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

   if (terminated) {
      return (
         <>
            <Helmet>
               <title>Game Terminated | Hearts</title>
            </Helmet>
            <PageLayout
               title="MULTIPLAYER"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <div className={styles.concededBackdrop}>
                  <div className={styles.concededModal}>
                     <p className={styles.concededTitle}>Game Terminated</p>
                     <p className="text-sm mb-3 opacity-80">
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
                                    <tr key={p.idx}>
                                       <td>{p.name}</td>
                                       <td>{p.score}</td>
                                    </tr>
                                 ))}
                           </tbody>
                        </table>
                     )}
                     <Link to="/game/create">
                        <Button
                           name="Create New Game"
                           style={{ width: "250px", marginTop: "8px" }}
                        />
                     </Link>
                     <Link to="/" onClick={() => triggerLogoFadeOut()}>
                        <Button name="Home" style={{ width: "250px" }} />
                     </Link>
                  </div>
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
      phaseHintText = "Spectating";
   } else if (state?.game_over) {
      phaseHintText = "";
   } else if (state?.phase === "passing") {
      if (passSubmitted) {
         phaseHintText = "Waiting for other players...";
      } else {
         phaseHintText = `Select 3 cards to pass ${state.pass_direction}`;
      }
   } else if (state?.phase === "playing") {
      if (state.whose_turn === mySeat) {
         phaseHintText = "Your turn!";
      } else {
         const turnPlayer = state.players[state.whose_turn]?.name ?? "";
         phaseHintText = `${turnPlayer}'s turn`;
      }
   }

   // ── Seat ordering: rotate so my seat is at bottom ─────────────────
   const rawPlayers = state?.players ?? [];
   const orderedPlayers = reorderSlotsForTableLayout(
      [...rawPlayers],
      effectiveMySeat
   );
   const orderedSlots = reorderSlotsForTableLayout([...slots], effectiveMySeat);
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
            {state && (
               <div className={styles.playContent}>
                  {!roundSummary && !isMobile && (
                     <div className={styles.topBar}>
                        <InfoPill
                           round={state.round}
                           passDirection={state.pass_direction}
                           phase={state.phase}
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
                        phase={state.phase}
                        players={state.players}
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
                              },
                           ]}
                           trickSlots={orderedSlots}
                           collectTarget={collectTarget}
                        />
                     ) : (
                        <div className={styles.gameTable}>
                           <div className={styles.seatTop}>
                              <GameSeat
                                 name={orderedPlayers[1]?.name ?? "—"}
                                 score={seatScore(orderedIndices[1])}
                                 isCurrentTurn={seatIsCurrentTurn(
                                    orderedIndices[1]
                                 )}
                                 position="top"
                                 showHearts={!!showHeartsOnSeats}
                                 heartCount={
                                    heartsPerPlayer[orderedIndices[1]] ?? 0
                                 }
                              />
                           </div>
                           <div className={styles.seatLeft}>
                              <GameSeat
                                 name={orderedPlayers[2]?.name ?? "—"}
                                 score={seatScore(orderedIndices[2])}
                                 isCurrentTurn={seatIsCurrentTurn(
                                    orderedIndices[2]
                                 )}
                                 position="left"
                                 showHearts={!!showHeartsOnSeats}
                                 heartCount={
                                    heartsPerPlayer[orderedIndices[2]] ?? 0
                                 }
                              />
                           </div>
                           <div className={styles.trickArea}>
                              <Trick
                                 slots={orderedSlots}
                                 collectTarget={collectTarget}
                              />
                           </div>
                           <div className={styles.seatRight}>
                              <GameSeat
                                 name={orderedPlayers[3]?.name ?? "—"}
                                 score={seatScore(orderedIndices[3])}
                                 isCurrentTurn={seatIsCurrentTurn(
                                    orderedIndices[3]
                                 )}
                                 position="right"
                                 showHearts={!!showHeartsOnSeats}
                                 heartCount={
                                    heartsPerPlayer[orderedIndices[3]] ?? 0
                                 }
                              />
                           </div>
                           <div className={styles.seatBottom}>
                              <GameSeat
                                 name={
                                    orderedPlayers[0]?.name ??
                                    (isSpectator ? "Host" : "You")
                                 }
                                 score={seatScore(orderedIndices[0])}
                                 isCurrentTurn={seatIsCurrentTurn(
                                    orderedIndices[0]
                                 )}
                                 position="bottom"
                                 showHearts={!!showHeartsOnSeats}
                                 heartCount={
                                    heartsPerPlayer[orderedIndices[0]] ?? 0
                                 }
                              />
                           </div>
                        </div>
                     )}
                  </div>

                  <div className={styles.phaseHint}>
                     <PhaseHint text={roundSummary ? null : phaseHintText} />
                  </div>

                  {/* Hand */}
                  {!isSpectator && !conceded && myHand.length > 0 && (
                     <div
                        className={`${handStyles.handWrapper} ${
                           dealingHand ? handStyles.dealingHand : ""
                        }`}
                     >
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
                     </div>
                  )}

                  {/* Spectator hand placeholder */}
                  {(isSpectator || conceded) && (
                     <div className={handStyles.handWrapper}>
                        <p
                           className="text-sm opacity-60"
                           style={{ padding: "20px 0" }}
                        >
                           {conceded
                              ? "You are spectating after conceding."
                              : "Spectating — enjoy the show!"}
                        </p>
                     </div>
                  )}

                  {/* Pass confirm button */}
                  {showPassUI && (
                     <div className={styles.passButton}>
                        <Button
                           name={`Pass ${state?.pass_direction ?? ""}`}
                           onClick={handleConfirmPass}
                           disabled={passSelection.size !== 3}
                           style={{ width: "200px", height: "48px" }}
                        />
                     </div>
                  )}

                  {/* Pass submitted waiting indicator */}
                  {state?.phase === "passing" &&
                     passSubmitted &&
                     !isSpectator &&
                     !conceded && (
                        <div className={styles.passButton}>
                           <p className="text-sm opacity-70">
                              Waiting for other players...
                           </p>
                        </div>
                     )}
               </div>
            )}
         </PageLayout>

         {/* Round summary overlay */}
         {roundSummary && (
            <RoundSummaryOverlay
               summary={roundSummary}
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

         {/* Round banner */}
         {roundBanner && !roundSummary && (
            <div className={styles.roundBanner}>
               <span className={styles.roundBannerText}>
                  Round {roundBanner.round}
               </span>
            </div>
         )}

         {/* Game over */}
         {state?.game_over && !terminated && (
            <div className={styles.gameOverBackdrop}>
               <div className={styles.gameOverBlock}>
                  <GameOverBlock
                     players={state.players}
                     winnerIndex={state.winner_index}
                  />
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
