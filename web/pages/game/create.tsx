import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

import { Button } from "@/components/Buttons";
import {
   CreateGameSelections,
   type NumAiPlayers,
} from "@/components/CreateGameSelections";
import { LoginWarning } from "@/components/LoginWarning";
import { Tooltip } from "@/components/Tooltip";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { startGame } from "@/lib/gameApi";

export default function CreateGamePage() {
   const router = useRouter();
   const { user } = useAuth();
   const [gameType, setGameType] = React.useState("Versus AI");
   const [difficulty, setDifficulty] = React.useState("Easy");
   const [aiPlayersEnabled, setAiPlayersEnabled] = React.useState(false);
   const [numAiPlayers, setNumAiPlayers] = React.useState<NumAiPlayers>(1);
   const [submitting, setSubmitting] = React.useState(false);
   const [error, setError] = React.useState<string | null>(null);

   async function handleCreateGame() {
      if (gameType !== "Versus AI") return;
      setError(null);
      setSubmitting(true);
      try {
         const result = await startGame({
            player_name: user?.name || undefined,
            difficulty: difficulty === "My Mom" ? "hard" : difficulty.toLowerCase(),
         });
         if (result.ok) {
            const gameId = result.data.game_id;
            router.push(`/game/play?game_id=${encodeURIComponent(gameId)}`);
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
         <Head>
            <title>Create Game | Hearts</title>
         </Head>
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
               />

               <div className="pt-4 mt-4">
                  {gameType !== "Versus AI" ? (
                     <Tooltip content="Online games coming soon!">
                        <span className="inline-block">
                           <Button
                              name={submitting ? "Starting…" : "Create Game!"}
                              disabled
                              style={{ height: "50px" }}
                              onClick={handleCreateGame}
                           />
                        </span>
                     </Tooltip>
                  ) : (
                     <Button
                        name={submitting ? "Starting…" : "Create Game!"}
                        disabled={submitting}
                        style={{ height: "50px" }}
                        onClick={handleCreateGame}
                     />
                  )}
                  {error != null && (
                     <p className="mt-2 text-red-600 text-sm" role="alert">
                        {error}
                     </p>
                  )}
               </div>
               <LoginWarning />
               <ButtonGroup className="pt-0">
                  <Link href="/">
                     <Button name="Home" style={{ width: "120px" }} />
                  </Link>
               </ButtonGroup>
            </div>
         </PageLayout>
      </>
   );
}
