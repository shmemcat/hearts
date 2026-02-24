import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import React from "react";

import { Button } from "@/components/Buttons";
import { CreateGameSelections } from "@/components/CreateGameSelections";
import { ActiveGameModal } from "@/components/game";
import { LoginWarning } from "@/components/LoginWarning";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useHardLevel } from "@/context/HardLevelContext";
import { startGame, checkActiveGame, concedeGame } from "@/lib/gameApi";
import {
   createLobby,
   getLobbyState,
   checkMultiplayerGameActive,
} from "@/lib/lobbyApi";
import {
   findActiveMultiplayerSession,
   clearMultiplayerSession,
   type ActiveMultiplayerSession,
} from "@/lib/multiplayerSession";

export default function CreateGamePage() {
   const navigate = useNavigate();
   const { user, token } = useAuth();
   const { hardLevel, hasChanged: hardLevelChanged } = useHardLevel();
   const [gameType, setGameType] = React.useState("Versus Bots");
   const [difficulty, setDifficulty] = React.useState("Easy");
   const [submitting, setSubmitting] = React.useState(false);
   const [error, setError] = React.useState<string | null>(null);
   const [activeGameId, setActiveGameId] = React.useState<string | null>(null);
   const [showActiveModal, setShowActiveModal] = React.useState(false);
   const [multiSession, setMultiSession] =
      React.useState<ActiveMultiplayerSession | null>(null);
   const [showMultiModal, setShowMultiModal] = React.useState(false);

   React.useEffect(() => {
      if (!token) return;
      checkActiveGame(token).then((res) => {
         if (res.ok && res.game_id) {
            setActiveGameId(res.game_id);
            setShowActiveModal(true);
         }
      });
   }, [token]);

   React.useEffect(() => {
      const session = findActiveMultiplayerSession();
      if (!session) return;
      if (session.type === "lobby") {
         getLobbyState(session.code).then((res) => {
            if (res.ok && res.data.status !== "finished") {
               setMultiSession(session);
               setShowMultiModal(true);
            } else {
               clearMultiplayerSession(session);
            }
         });
      } else {
         checkMultiplayerGameActive(session.gameId).then((active) => {
            if (active) {
               setMultiSession(session);
               setShowMultiModal(true);
            } else {
               clearMultiplayerSession(session);
            }
         });
      }
   }, []);

   async function handleCreateGame() {
      setError(null);
      setSubmitting(true);

      if (gameType === "Online") {
         try {
            const hostName = user?.name || "Host";
            const result = await createLobby(hostName);
            if (result.ok) {
               localStorage.setItem(
                  `hearts_lobby_token_${result.data.code}`,
                  result.data.player_token
               );
               navigate(`/game/lobby/${result.data.code}`);
            } else {
               setError(result.error);
            }
         } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create lobby");
         } finally {
            setSubmitting(false);
         }
         return;
      }

      try {
         const result = await startGame(
            {
               player_name: user?.name || undefined,
               difficulty:
                  difficulty === "My Mom"
                     ? hardLevel
                     : difficulty.toLowerCase(),
            },
            token
         );
         if (result.ok) {
            const gameId = result.data.game_id;
            navigate(`/game/play?game_id=${encodeURIComponent(gameId)}`);
         } else {
            setError(result.error);
         }
      } catch (e) {
         setError(e instanceof Error ? e.message : "Failed to start game");
      } finally {
         setSubmitting(false);
      }
   }

   async function handleConcedeActive() {
      if (!activeGameId) return;
      await concedeGame(activeGameId, token);
      setActiveGameId(null);
      setShowActiveModal(false);
   }

   return (
      <>
         <Helmet>
            <title>Create Game | Hearts</title>
         </Helmet>
         <PageLayout title="CREATE GAME">
            <div className="flex flex-col w-[440px] max-md:w-[300px]">
               <CreateGameSelections
                  gameType={gameType}
                  onGameTypeChange={setGameType}
                  difficulty={difficulty}
                  onDifficultyChange={setDifficulty}
                  showHardTooltip={!!user && !hardLevelChanged}
               />

               <div className="pt-4 mt-4">
                  <Button
                     name={submitting ? "Starting…" : "Create Game!"}
                     disabled={submitting}
                     style={{ height: "50px" }}
                     onClick={handleCreateGame}
                  />
                  {error != null && (
                     <p className="mt-2 text-red-600 text-sm" role="alert">
                        {error}
                     </p>
                  )}
               </div>
               <LoginWarning />
               <ButtonGroup className="pt-0">
                  <Link to="/" onClick={() => triggerLogoFadeOut()}>
                     <Button name="Home" style={{ width: "120px" }} />
                  </Link>
               </ButtonGroup>
            </div>
         </PageLayout>
         {showActiveModal && activeGameId && (
            <ActiveGameModal
               onContinue={() =>
                  navigate(
                     `/game/play?game_id=${encodeURIComponent(activeGameId)}`
                  )
               }
               onConcede={handleConcedeActive}
            />
         )}
         {showMultiModal && multiSession && !showActiveModal && (
            <ActiveGameModal
               title={
                  multiSession.type === "lobby"
                     ? "Lobby In Progress"
                     : "Multiplayer Game In Progress"
               }
               message={
                  multiSession.type === "lobby"
                     ? "You have an active lobby. Rejoin?"
                     : "You have a multiplayer game in progress. Rejoin?"
               }
               continueLabel="Rejoin"
               concedeLabel="Leave"
               confirmMessage={
                  multiSession.type === "lobby"
                     ? "Are you sure you want to leave the lobby?"
                     : "Are you sure you want to leave the game? Your seat will be taken over by a bot."
               }
               onContinue={() => {
                  if (multiSession.type === "lobby") {
                     navigate(`/game/lobby/${multiSession.code}`);
                  } else {
                     navigate(
                        `/game/multi-play?game_id=${encodeURIComponent(
                           multiSession.gameId
                        )}`
                     );
                  }
               }}
               onConcede={() => {
                  clearMultiplayerSession(multiSession);
                  setMultiSession(null);
                  setShowMultiModal(false);
               }}
            />
         )}
      </>
   );
}
