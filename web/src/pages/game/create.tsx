import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import React from "react";

import { Button } from "@/components/Buttons";
import {
   CreateGameSelections,
   type NumAiPlayers,
} from "@/components/CreateGameSelections";
import { ActiveGameModal } from "@/components/game";
import { LoginWarning } from "@/components/LoginWarning";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useHardLevel } from "@/context/HardLevelContext";
import { startGame, checkActiveGame, concedeGame } from "@/lib/gameApi";
import { createLobby } from "@/lib/lobbyApi";

export default function CreateGamePage() {
   const navigate = useNavigate();
   const { user, token } = useAuth();
   const { hardLevel, hasChanged: hardLevelChanged } = useHardLevel();
   const [gameType, setGameType] = React.useState("Versus AI");
   const [difficulty, setDifficulty] = React.useState("Easy");
   const [aiPlayersEnabled, setAiPlayersEnabled] = React.useState(false);
   const [numAiPlayers, setNumAiPlayers] = React.useState<NumAiPlayers>(1);
   const [submitting, setSubmitting] = React.useState(false);
   const [error, setError] = React.useState<string | null>(null);
   const [activeGameId, setActiveGameId] = React.useState<string | null>(null);
   const [showActiveModal, setShowActiveModal] = React.useState(false);

   React.useEffect(() => {
      if (!token) return;
      checkActiveGame(token).then((res) => {
         if (res.ok && res.game_id) {
            setActiveGameId(res.game_id);
            setShowActiveModal(true);
         }
      });
   }, [token]);

   async function handleCreateGame() {
      setError(null);
      setSubmitting(true);

      if (gameType === "Online") {
         try {
            const hostName = user?.name || "Host";
            const numAi = aiPlayersEnabled ? numAiPlayers : 0;
            const result = await createLobby(hostName, numAi);
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
                  aiPlayersEnabled={aiPlayersEnabled}
                  onAiPlayersEnabledChange={setAiPlayersEnabled}
                  numAiPlayers={numAiPlayers}
                  onNumAiPlayersChange={setNumAiPlayers}
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
      </>
   );
}
