import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

import { Button } from "@/components/buttons";
import { CreateGameSelections } from "@/components/radiobuttons";
import { LoginWarning } from "@/components/loginwarning";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { getApiUrl } from "@/lib/api";

export default function CreateGamePage() {
   const router = useRouter();
   const [gameType, setGameType] = React.useState("Versus AI");
   const [difficulty, setDifficulty] = React.useState("Easy");
   const [submitting, setSubmitting] = React.useState(false);
   const [error, setError] = React.useState<string | null>(null);

   async function handleCreateGame() {
      if (gameType !== "Versus AI") return;
      setError(null);
      setSubmitting(true);
      try {
         const res = await fetch(`${getApiUrl()}/games/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
         });
         const data = await res.json().catch(() => ({}));
         if (!res.ok) {
            setError(data?.error ?? `Request failed (${res.status})`);
            return;
         }
         const gameId = data.game_id;
         if (gameId) {
            router.push(`/game/play?game_id=${encodeURIComponent(gameId)}`);
         } else {
            setError("No game_id in response");
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
            <link rel="icon" href="/images/favicon.ico" />
            <meta name="description" content="Hearts web application" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
         <PageLayout title="CREATE GAME">
            <div className="flex flex-col w-[425px] max-md:w-[300px]">
               <CreateGameSelections
                  gameType={gameType}
                  onGameTypeChange={setGameType}
                  difficulty={difficulty}
                  onDifficultyChange={setDifficulty}
               />

               <div className="pt-4 mt-4">
                  <Button
                     name={submitting ? "Starting…" : "Create Game!"}
                     disabled={gameType !== "Versus AI" || submitting}
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
                  <Link href="/">
                     <Button name="Home" style={{ width: "120px" }} />
                  </Link>
               </ButtonGroup>
            </div>
         </PageLayout>
      </>
   );
}
