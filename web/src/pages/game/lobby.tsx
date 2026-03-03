import { Helmet } from "react-helmet-async";
import { Link, useParams, useNavigate } from "react-router-dom";
import React, { useEffect, useCallback, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCrown, faCopy, faCheck } from "@fortawesome/pro-solid-svg-icons";

import { Button } from "@/components/Buttons";
import { BotDifficultyModal } from "@/components/game/BotDifficultyModal";
import { PlayerIcon } from "@/components/game/PlayerIcon";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useSound } from "@/context/SoundContext";
import { getLobbyState } from "@/lib/lobbyApi";
import {
   connectLobby,
   disconnect as disconnectLobby,
   sendJoin,
   sendLeave,
   sendStartGame,
   sendCloseLobby,
   onLobbyUpdate,
   onJoinAck,
   onGameStarted,
   onLobbyClosed,
   onError,
} from "@/lib/lobbySocket";
import type { LobbyState, LobbySeat } from "@/types/lobby";
import { PLAY_PAGE_LAYOUT_CLASS } from "@/lib/constants";
import styles from "@/styles/lobby.module.css";

const MP_TOKEN_KEY = (gameId: string) => `hearts_mp_token_${gameId}`;
const MP_SEAT_KEY = (gameId: string) => `hearts_mp_seat_${gameId}`;
const MP_LOBBY_KEY = (gameId: string) => `hearts_mp_lobby_${gameId}`;
const LOBBY_TOKEN_KEY = (code: string) => `hearts_lobby_token_${code}`;

export default function LobbyPage() {
   const { code } = useParams<{ code: string }>();
   const navigate = useNavigate();
   const { user } = useAuth();
   const { play: playSound } = useSound();
   const upperCode = (code ?? "").toUpperCase();

   const [lobby, setLobby] = useState<LobbyState | null>(null);
   const [loading, setLoading] = useState(true);
   const [notFound, setNotFound] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [closed, setClosed] = useState(false);

   // The current player's token for this lobby (stored in localStorage)
   const [myToken, setMyToken] = useState<string | null>(() =>
      localStorage.getItem(LOBBY_TOKEN_KEY(upperCode))
   );
   const myTokenRef = useRef(myToken);
   myTokenRef.current = myToken;
   const prevHumanCountRef = useRef<number | null>(null);

   // Join form state — pre-fill with username if logged in
   const [joinName, setJoinName] = useState(user?.name ?? "");
   const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

   useEffect(() => {
      if (user?.name && !nameManuallyEdited) {
         setJoinName(user.name);
      }
   }, [user?.name, nameManuallyEdited]);

   // Bot difficulty modal
   const [showDiffModal, setShowDiffModal] = useState(false);

   // Copy-to-clipboard feedback
   const [copiedCode, setCopiedCode] = useState(false);
   const [copiedUrl, setCopiedUrl] = useState(false);

   // Derived: am I the host?
   const isHost = myToken != null && lobby?.host_token === myToken;
   // Am I seated?
   const mySeatIndex = lobby?.seats.find(
      (s) =>
         s.status === "human" &&
         myToken != null &&
         lobby.host_token === myToken &&
         s.index === 0
   )
      ? 0
      : lobby?.seats.findIndex((s) => {
           if (s.status !== "human" || !myToken) return false;
           // We can only check host_token for seat 0 via the lobby state.
           // For other seats we rely on the join_ack having set myToken.
           // The lobby_update doesn't expose individual player_tokens so we
           // track seat via the join_ack callback.
           return false;
        }) ?? -1;
   // A simpler approach: track my seat from join_ack
   const [mySeat, setMySeat] = useState<number | null>(null);

   // On mount: check localStorage for existing seat info
   useEffect(() => {
      const savedToken = localStorage.getItem(LOBBY_TOKEN_KEY(upperCode));
      if (savedToken) {
         setMyToken(savedToken);
      }
   }, [upperCode]);

   // Initial REST load to check lobby exists
   useEffect(() => {
      if (!upperCode) {
         setLoading(false);
         setNotFound(true);
         return;
      }
      getLobbyState(upperCode).then((res) => {
         setLoading(false);
         if (!res.ok) {
            setNotFound(true);
            return;
         }
         setLobby(res.data);
      });
   }, [upperCode]);

   // WebSocket connection
   useEffect(() => {
      if (!upperCode || notFound) return;
      const token =
         localStorage.getItem(LOBBY_TOKEN_KEY(upperCode)) ?? undefined;
      connectLobby(upperCode, token);
      return () => disconnectLobby();
   }, [upperCode, notFound]);

   // WebSocket event subscriptions
   useEffect(() => {
      const unsubUpdate = onLobbyUpdate((state) => {
         const humanCount = state.seats.filter(
            (s) => s.status === "human"
         ).length;
         if (
            prevHumanCountRef.current !== null &&
            humanCount > prevHumanCountRef.current
         ) {
            playSound("playerJoin");
         }
         prevHumanCountRef.current = humanCount;
         setLobby(state);
      });

      const unsubJoinAck = onJoinAck((event) => {
         const token = event.player_token;
         localStorage.setItem(LOBBY_TOKEN_KEY(upperCode), token);
         setMyToken(token);
         setMySeat(event.seat_index);
         // Reconnect socket with the new token so the server knows us
         disconnectLobby();
         connectLobby(upperCode, token);
      });

      const unsubStarted = onGameStarted((event) => {
         const gameId = event.game_id;
         const token = myTokenRef.current;
         if (token) {
            const assignment = event.seat_assignments.find(
               (a) => a.player_token === token
            );
            if (assignment) {
               localStorage.setItem(MP_TOKEN_KEY(gameId), token);
               localStorage.setItem(
                  MP_SEAT_KEY(gameId),
                  String(assignment.seat_index)
               );
            }
         }
         localStorage.setItem(MP_LOBBY_KEY(gameId), upperCode);
         localStorage.removeItem(LOBBY_TOKEN_KEY(upperCode));
         navigate(`/game/multi-play?game_id=${encodeURIComponent(gameId)}`);
      });

      const unsubClosed = onLobbyClosed(() => {
         setClosed(true);
         localStorage.removeItem(LOBBY_TOKEN_KEY(upperCode));
      });

      const unsubError = onError((msg) => {
         setError(msg);
      });

      return () => {
         unsubUpdate();
         unsubJoinAck();
         unsubStarted();
         unsubClosed();
         unsubError();
      };
   }, [upperCode, navigate, playSound]);

   const [nameError, setNameError] = useState(false);

   const handleJoinSeat = useCallback(
      (seatIndex: number) => {
         if (user?.name) {
            sendJoin(user.name, user.profile_icon, seatIndex);
            return;
         }
         const name = joinName.trim();
         if (!name) {
            setNameError(true);
            return;
         }
         setNameError(false);
         sendJoin(name, undefined, seatIndex);
      },
      [joinName, user]
   );

   const handleLeave = useCallback(() => {
      sendLeave();
      localStorage.removeItem(LOBBY_TOKEN_KEY(upperCode));
      setMyToken(null);
      setMySeat(null);
   }, [upperCode]);

   const handleCloseLobby = useCallback(() => {
      sendCloseLobby();
      localStorage.removeItem(LOBBY_TOKEN_KEY(upperCode));
   }, [upperCode]);

   const handleStartGame = useCallback(() => {
      if (!lobby) return;
      const aiCount = lobby.seats.filter(
         (s) => s.status === "ai" || s.status === "empty"
      ).length;
      if (aiCount === 0) {
         sendStartGame("easy");
      } else {
         setShowDiffModal(true);
      }
   }, [lobby]);

   const handleConfirmStart = useCallback((difficulty: string) => {
      setShowDiffModal(false);
      sendStartGame(difficulty);
   }, []);

   const handleCopy = useCallback(
      async (text: string, which: "code" | "url") => {
         try {
            await navigator.clipboard.writeText(text);
            if (which === "code") {
               setCopiedCode(true);
               setTimeout(() => setCopiedCode(false), 2000);
            } else {
               setCopiedUrl(true);
               setTimeout(() => setCopiedUrl(false), 2000);
            }
         } catch {
            /* clipboard not available */
         }
      },
      []
   );

   // ── Early returns ──────────────────────────────────────────────────

   if (loading) {
      return (
         <>
            <Helmet>
               <title>Lobby | Hearts</title>
            </Helmet>
            <PageLayout
               title="LOBBY"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <div className="animate-pulse flex flex-col gap-4 w-full max-w-md">
                  <div className="h-8 bg-mediumpink rounded w-1/3" />
                  <div className="h-24 bg-mediumpink rounded" />
               </div>
            </PageLayout>
         </>
      );
   }

   if (notFound || closed) {
      return (
         <>
            <Helmet>
               <title>Lobby | Hearts</title>
            </Helmet>
            <PageLayout
               title="LOBBY"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <p>{closed ? "Lobby has been closed." : "Lobby not found."}</p>
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

   // Game already in progress — offer spectator link
   if (lobby?.status === "playing" && lobby.game_id && !myToken) {
      return (
         <>
            <Helmet>
               <title>Lobby | Hearts</title>
            </Helmet>
            <PageLayout
               title="LOBBY"
               hideTitleBlock
               className={PLAY_PAGE_LAYOUT_CLASS}
            >
               <div className={styles.statusMessage}>
                  <h2>Game in Progress</h2>
                  <p>This lobby's game has already started.</p>
               </div>
               <ButtonGroup className="pt-4">
                  <Link
                     to={`/game/multi-play?game_id=${encodeURIComponent(
                        lobby.game_id
                     )}`}
                  >
                     <Button name="Watch" style={{ width: "200px" }} />
                  </Link>
                  <Link to="/" onClick={() => triggerLogoFadeOut()}>
                     <Button name="Home" style={{ width: "200px" }} />
                  </Link>
               </ButtonGroup>
            </PageLayout>
         </>
      );
   }

   // ── Render helpers ─────────────────────────────────────────────────

   const lobbyUrl = `${window.location.origin}/game/lobby/${upperCode}`;
   const isVisitor = myToken == null;
   const isFull =
      lobby != null &&
      lobby.seats.every((s) => s.status === "human" || s.status === "ai");
   const aiCount =
      lobby?.seats.filter((s) => s.status === "ai" || s.status === "empty")
         .length ?? 0;

   const positionClass = (idx: number) => {
      switch (idx) {
         case 0:
            return styles.seatBottom;
         case 1:
            return styles.seatLeft;
         case 2:
            return styles.seatTop;
         case 3:
            return styles.seatRight;
         default:
            return "";
      }
   };

   const renderSeat = (seat: LobbySeat) => {
      const seatIsHost =
         lobby != null &&
         seat.index === 0 &&
         lobby.seats[0]?.status === "human";
      const canSelect =
         seat.status === "empty" && isVisitor && lobby?.status === "waiting";
      return (
         <div
            key={seat.index}
            className={`${styles.seat} ${positionClass(seat.index)} ${
               seatIsHost ? styles.isHost : ""
            } ${seat.status === "empty" ? styles.isEmpty : ""}`}
         >
            {canSelect ? (
               <button
                  className={styles.selectSeatBtn}
                  onClick={() => handleJoinSeat(seat.index)}
               >
                  <span>Select</span>
                  <span>Seat</span>
               </button>
            ) : (
               <>
                  <span className={styles.seatName}>
                     {seat.status === "empty" ? (
                        <>
                           Waiting
                           <span className={styles.waitingDots} />
                        </>
                     ) : (
                        <>
                           <PlayerIcon
                              name={seat.name ?? ""}
                              icon={seat.icon}
                              size={14}
                           />{" "}
                           {seat.name ?? "—"}
                        </>
                     )}
                     {seatIsHost && (
                        <FontAwesomeIcon
                           icon={faCrown}
                           className={styles.crownIcon}
                        />
                     )}
                  </span>
                  <span className={styles.seatLabel}>
                     {seat.status === "ai"
                        ? "Bot"
                        : seat.status === "human"
                        ? "Player"
                        : "Open"}
                  </span>
               </>
            )}
         </div>
      );
   };

   return (
      <>
         <Helmet>
            <title>Lobby {upperCode} | Hearts</title>
         </Helmet>
         <PageLayout
            title="LOBBY"
            hideTitleBlock
            className={PLAY_PAGE_LAYOUT_CLASS}
         >
            <div className={styles.lobbyContent}>
               {error && (
                  <p className="text-red-600 text-sm" role="alert">
                     {error}
                  </p>
               )}

               {/* Lobby code + URL (visible to host and seated players) */}
               {!isVisitor && (
                  <div className={styles.lobbyInfo}>
                     <div className={styles.copyRow}>
                        <label>Code</label>
                        <input
                           className={styles.copyInput}
                           readOnly
                           value={upperCode}
                        />
                        <button
                           className={styles.copyButton}
                           onClick={() => handleCopy(upperCode, "code")}
                           title="Copy code"
                        >
                           <FontAwesomeIcon
                              icon={copiedCode ? faCheck : faCopy}
                           />
                        </button>
                     </div>
                     <div className={styles.copyRow}>
                        <label>URL</label>
                        <input
                           className={styles.copyInput}
                           readOnly
                           value={lobbyUrl}
                        />
                        <button
                           className={styles.copyButton}
                           onClick={() => handleCopy(lobbyUrl, "url")}
                           title="Copy URL"
                        >
                           <FontAwesomeIcon
                              icon={copiedUrl ? faCheck : faCopy}
                           />
                        </button>
                     </div>
                  </div>
               )}

               {/* Seats grid */}
               {lobby && (
                  <div className={styles.seatsGrid}>
                     {lobby.seats.map(renderSeat)}
                     <div className={styles.seatCenter}>
                        {/* Visitor: name input (no Join button — use Select Seat on empty seats) */}
                        {isVisitor && lobby.status === "waiting" && !user && (
                           <>
                              {isFull ? (
                                 <p className="text-sm opacity-70">
                                    Lobby is full
                                 </p>
                              ) : (
                                 <div className={styles.joinForm}>
                                    <input
                                       className={styles.joinInput}
                                       type="text"
                                       placeholder="Your name"
                                       value={joinName}
                                       onChange={(e) => {
                                          setJoinName(e.target.value);
                                          setNameManuallyEdited(true);
                                          if (e.target.value.trim())
                                             setNameError(false);
                                       }}
                                       maxLength={20}
                                    />
                                    {nameError && (
                                       <span className={styles.nameError}>
                                          State your name!
                                       </span>
                                    )}
                                 </div>
                              )}
                           </>
                        )}

                        {/* Host: start game button */}
                        {isHost && lobby.status === "waiting" && (
                           <Button
                              name="Start Game"
                              onClick={handleStartGame}
                              style={{
                                 height: "52px",
                                 width: "100px",
                                 lineHeight: "1.2",
                                 display: "flex",
                                 flexDirection: "column",
                                 alignItems: "center",
                                 justifyContent: "center",
                              }}
                           >
                              <span>Start</span>
                              <span>Game</span>
                           </Button>
                        )}

                        {/* Non-host seated player: leave button */}
                        {!isVisitor &&
                           !isHost &&
                           lobby?.status === "waiting" && (
                              <Button
                                 name="Leave Lobby"
                                 onClick={handleLeave}
                                 style={{
                                    height: "52px",
                                    width: "100px",
                                    lineHeight: "1.2",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                 }}
                              >
                                 <span>Leave</span>
                                 <span>Lobby</span>
                              </Button>
                           )}
                     </div>
                  </div>
               )}

               <ButtonGroup className="pt-0">
                  {isHost && lobby?.status === "waiting" && (
                     <Button
                        name="Close Lobby"
                        onClick={handleCloseLobby}
                        style={{ width: "160px" }}
                     />
                  )}
                  <Link to="/" onClick={() => triggerLogoFadeOut()}>
                     <Button name="Home" style={{ width: "120px" }} />
                  </Link>
               </ButtonGroup>
            </div>
         </PageLayout>

         {showDiffModal && (
            <BotDifficultyModal
               botCount={aiCount}
               onConfirm={handleConfirmStart}
               onCancel={() => setShowDiffModal(false)}
            />
         )}
      </>
   );
}
