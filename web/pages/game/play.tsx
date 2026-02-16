import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/buttons";
import { Hand } from "@/components/game/Hand";
import { Trick } from "@/components/game/Trick";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { advanceGame, getGameState, submitPass, submitPlay } from "@/lib/game-api";
import type { CurrentTrickSlot, GameState, PlayEvent, PlayResponse } from "@/types/game";
import styles from "@/styles/play.module.css";

const AI_PLAY_DELAY_MS = 1000;
const ROUND_END_DELAY_MS = 3000;

function buildSlotsFromPlays(plays: PlayEvent[]): CurrentTrickSlot[] {
   const slots: CurrentTrickSlot[] = [null, null, null, null];
   for (const p of plays) {
      slots[p.player_index] = { player_index: p.player_index, card: p.card };
   }
   return slots;
}

export default function PlayGamePage() {
   const router = useRouter();
   const { game_id: gameId } = router.query;
   const [loading, setLoading] = useState(true);
   const [notFound, setNotFound] = useState(false);
   const [state, setState] = useState<GameState | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const [passSelection, setPassSelection] = useState<Set<string>>(new Set());
   const [displayTrickSlots, setDisplayTrickSlots] = useState<CurrentTrickSlot[] | null>(null);
   const animationTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

   useEffect(() => {
      return () => {
         animationTimeoutsRef.current.forEach(clearTimeout);
         animationTimeoutsRef.current = [];
      };
   }, []);

   const runPlayResponseAnimation = useCallback((data: PlayResponse) => {
      setState(data);
      const plays = data.intermediate_plays ?? [];
      if (plays.length === 0) {
         setSubmitting(false);
         return;
      }
      setDisplayTrickSlots(buildSlotsFromPlays(plays.slice(0, 1)));
      for (let i = 1; i < plays.length; i++) {
         const t = setTimeout(
            () => setDisplayTrickSlots(buildSlotsFromPlays(plays.slice(0, i + 1))),
            AI_PLAY_DELAY_MS * i
         );
         animationTimeoutsRef.current.push(t);
      }
      const delayUntilDone = AI_PLAY_DELAY_MS * plays.length;
      const roundEndExtra = data.round_just_ended ? ROUND_END_DELAY_MS : 0;
      const t = setTimeout(
         () => {
            setDisplayTrickSlots(null);
            setSubmitting(false);
         },
         delayUntilDone + roundEndExtra
      );
      animationTimeoutsRef.current.push(t);
   }, []);

   useEffect(() => {
      if (typeof gameId !== "string" || !gameId) {
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
            if (data.phase === "playing" && data.whose_turn !== 0) {
               advanceGame(gameId)
                  .then((advResult) => {
                     if (cancelled) return;
                     if (!advResult.ok) {
                        setError(advResult.error);
                        setLoading(false);
                        return;
                     }
                     setLoading(false);
                     setSubmitting(true);
                     runPlayResponseAnimation(advResult.data);
                  })
                  .catch((e) => {
                     if (cancelled) return;
                     setError(e instanceof Error ? e.message : "Failed to advance game");
                     setLoading(false);
                  });
            } else {
               setState(data);
               setLoading(false);
            }
         })
         .catch((e) => {
            if (cancelled) return;
            setError(e instanceof Error ? e.message : "Failed to load game");
            setLoading(false);
         });
      return () => {
         cancelled = true;
      };
   }, [gameId, runPlayResponseAnimation]);

   const handlePassCardToggle = useCallback((code: string) => {
      setPassSelection((prev) => {
         const next = new Set(prev);
         if (next.has(code)) next.delete(code);
         else if (next.size < 3) next.add(code);
         return next;
      });
   }, []);

   const handleSubmitPass = useCallback(() => {
      if (typeof gameId !== "string" || passSelection.size !== 3) return;
      setSubmitting(true);
      const cards = Array.from(passSelection) as [string, string, string];
      submitPass(gameId, { cards })
         .then((result) => {
            if (!result.ok) {
               setError(result.error);
               setSubmitting(false);
               return;
            }
            setState(result.data);
            setPassSelection(new Set());
            if (result.data.phase === "playing" && result.data.whose_turn !== 0) {
               advanceGame(gameId)
                  .then((advResult) => {
                     if (!advResult.ok) {
                        setError(advResult.error);
                        setSubmitting(false);
                        return;
                     }
                     runPlayResponseAnimation(advResult.data);
                  })
                  .catch((e) => {
                     setError(e instanceof Error ? e.message : "Advance failed");
                     setSubmitting(false);
                  });
            } else {
               setSubmitting(false);
            }
         })
         .catch((e) => {
            setError(e instanceof Error ? e.message : "Submit failed");
            setSubmitting(false);
         });
   }, [gameId, passSelection, runPlayResponseAnimation]);

   const handlePlayCard = useCallback(
      (code: string) => {
         if (typeof gameId !== "string") return;
         setSubmitting(true);
         submitPlay(gameId, { card: code })
            .then((result) => {
               if (!result.ok) {
                  setError(result.error);
                  setSubmitting(false);
                  return;
               }
               runPlayResponseAnimation(result.data);
            })
            .catch((e) => {
               setError(e instanceof Error ? e.message : "Play failed");
               setSubmitting(false);
            });
      },
      [gameId, runPlayResponseAnimation]
   );

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
               <div className={styles.playContent}>
                  <header className={styles.playHeader}>
                     <span>
                        Round {state.round}
                        {state.pass_direction !== "none" && (
                           <> · Pass {state.pass_direction}</>
                        )}
                     </span>
                     <span className={styles.playPhase}>{state.phase}</span>
                     <div className={styles.playScores}>
                        {state.players.map((p, i) => (
                           <span key={i}>
                              {p.name}: {p.score}
                           </span>
                        ))}
                     </div>
                  </header>

                  <Trick
                     slots={
                        state.phase === "passing"
                           ? [null, null, null, null]
                           : (displayTrickSlots ?? state.current_trick)
                     }
                     playerNames={state.players.map((p) => p.name)}
                  />

                  {state.phase === "passing" && (
                     <>
                        <p className={styles.passHint}>
                           Select 3 cards to pass {state.pass_direction}.
                        </p>
                        <Hand
                           cards={state.human_hand}
                           selectedCodes={passSelection}
                           onCardClick={handlePassCardToggle}
                           selectionMode
                        />
                        <div className={styles.passActions}>
                           <Button
                              name="Submit pass"
                              disabled={passSelection.size !== 3 || submitting}
                              onClick={handleSubmitPass}
                              style={{ width: "180px" }}
                           />
                        </div>
                     </>
                  )}

                  {state.phase === "playing" && (
                     <Hand
                        cards={state.human_hand}
                        legalCodes={new Set(state.legal_plays)}
                        onCardClick={
                           state.whose_turn === 0 && !state.game_over
                              ? handlePlayCard
                              : undefined
                        }
                     />
                  )}

                  {state.game_over && (
                     <p className={styles.gameOverMessage}>
                        Game over.
                        {state.winner_index != null &&
                           state.players[state.winner_index] && (
                              <> Winner: {state.players[state.winner_index].name}</>
                           )}
                     </p>
                  )}
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
