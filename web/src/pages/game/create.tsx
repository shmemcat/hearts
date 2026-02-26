import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import React from "react";

import { Button } from "@/components/Buttons";
import { CreateGameSelections } from "@/components/CreateGameSelections";
import { LoginWarning } from "@/components/LoginWarning";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useHardLevel } from "@/context/HardLevelContext";
import { useActiveGameModals } from "@/hooks/useActiveGameModals";
import { startGame } from "@/lib/gameApi";
import { createLobby } from "@/lib/lobbyApi";

export default function CreateGamePage() {
   const navigate = useNavigate();
   const { user, token } = useAuth();
   const { hardLevel, hasChanged: hardLevelChanged } = useHardLevel();
   const [gameType, setGameType] = React.useState("Versus Bots");
   const [difficulty, setDifficulty] = React.useState("Easy");
   const [submitting, setSubmitting] = React.useState(false);
   const [error, setError] = React.useState<string | null>(null);
   const activeGameModals = useActiveGameModals();

   async function handleCreateGame() {
      setError(null);
      setSubmitting(true);

      if (gameType === "Online") {
         try {
            const hostName = user?.name || "Host";
            const result = await createLobby(hostName, user?.profile_icon);
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
            navigate(`/game/single-play?game_id=${encodeURIComponent(gameId)}`);
         } else {
            setError(result.error);
         }
      } catch (e) {
         setError(e instanceof Error ? e.message : "Failed to start game");
      } finally {
         setSubmitting(false);
      }
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
         {activeGameModals}
      </>
   );
}
