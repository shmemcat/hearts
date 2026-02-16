import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

import { Button } from "@/components/buttons";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { getApiUrl } from "@/lib/api";

type GameState = {
   phase: string;
   round: number;
   human_hand: string[];
   players: { name: string; score: number; card_count: number }[];
   game_over?: boolean;
   [key: string]: unknown;
} | null;

export default function PlayGamePage() {
   const router = useRouter();
   const { game_id: gameId } = router.query;
   const [loading, setLoading] = useState(true);
   const [notFound, setNotFound] = useState(false);
   const [state, setState] = useState<GameState>(null);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      if (typeof gameId !== "string" || !gameId) {
         setLoading(false);
         return;
      }
      let cancelled = false;
      setLoading(true);
      setNotFound(false);
      setError(null);
      fetch(`${getApiUrl()}/games/${encodeURIComponent(gameId)}`)
         .then((res) => {
            if (cancelled) return;
            if (res.status === 404) {
               setNotFound(true);
               setLoading(false);
               return;
            }
            if (!res.ok) {
               setError(`Request failed (${res.status})`);
               setLoading(false);
               return;
            }
            return res.json();
         })
         .then((data) => {
            if (cancelled) return;
            if (data != null) setState(data);
            setLoading(false);
         })
         .catch((e) => {
            if (cancelled) return;
            setError(e instanceof Error ? e.message : "Failed to load game");
            setLoading(false);
         });
      return () => {
         cancelled = true;
      };
   }, [gameId]);

   if (typeof gameId !== "string" || !gameId) {
      return (
         <>
            <Head>
               <title>Play Game | Hearts</title>
               <link rel="icon" href="/images/favicon.ico" />
            </Head>
            <PageLayout title="PLAY GAME" hideTitleBlock>
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
            <PageLayout title="PLAY GAME" hideTitleBlock>
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
            <PageLayout title="PLAY GAME" hideTitleBlock>
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
            <PageLayout title="PLAY GAME" hideTitleBlock>
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

   return (
      <>
         <Head>
            <title>Play Game | Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
         </Head>
         <PageLayout title="PLAY GAME" hideTitleBlock>
            {state && (
               <div className="flex flex-col gap-2">
                  <p>
                     Round {state.round} · Phase: {state.phase}
                  </p>
                  {state.players?.length > 0 && (
                     <p>
                        {state.players
                           .map((p) => `${p.name} (${p.score})`)
                           .join(" · ")}
                     </p>
                  )}
                  {state.human_hand?.length != null && (
                     <p>Your hand: {state.human_hand.length} cards</p>
                  )}
                  {state.game_over && <p>Game over.</p>}
               </div>
            )}
            <ButtonGroup className="pt-4">
               <Link href="/game/create">
                  <Button name="Create New Game" style={{ width: "250px" }} />
               </Link>
               <Link href="/">
                  <Button name="Home" style={{ width: "250px" }} />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
