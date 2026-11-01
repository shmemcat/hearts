import { useId, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRobot, faUsers } from "@fortawesome/pro-solid-svg-icons";
import { Button } from "./Buttons";
import styles from "./InProgressGames.module.css";

export type SavedGameCard = {
   id: string;
   title: string;
   mode: string;
   progress: string;
   status: string;
   multiplayer: boolean;
   concedeMessage?: string;
   concedeDisabled?: boolean;
};

export function InProgressGames({
   games,
   loading,
   error,
   onResume,
   onConcede,
   onRetry,
}: {
   games: SavedGameCard[];
   loading?: boolean;
   error?: string;
   onResume: (id: string) => void | Promise<void>;
   onConcede: (id: string) => void | Promise<void>;
   onRetry?: () => void;
}) {
   const heading = useId();
   const [confirming, setConfirming] = useState<string | null>(null);
   const [busy, setBusy] = useState<string | null>(null);
   const [actionError, setActionError] = useState<{
      id: string;
      message: string;
   } | null>(null);
   async function perform(
      id: string,
      action: (id: string) => void | Promise<void>
   ) {
      if (busy) return;
      setBusy(id);
      setActionError(null);
      try {
         await action(id);
         setConfirming(null);
      } catch (e) {
         setActionError({
            id,
            message: e instanceof Error ? e.message : "Please try again.",
         });
      } finally {
         setBusy(null);
      }
   }
   if (!games.length && !loading && !error) return null;
   return (
      <section className={styles.section} aria-labelledby={heading}>
         <h2 id={heading}>Games in progress</h2>
         {loading && <p role="status">Checking your saved games…</p>}
         {error && (
            <div role="alert">
               <p>{error}</p>
               {onRetry && (
                  <Button
                     name="Try again"
                     variant="secondary"
                     size="compact"
                     onClick={onRetry}
                  />
               )}
            </div>
         )}
         <div className={styles.grid}>
            {games.map((game) => (
               <article
                  className={styles.card}
                  key={game.id}
                  aria-label={game.title}
               >
                  <div className={styles.top}>
                     <span>{game.mode}</span>
                     <FontAwesomeIcon
                        icon={game.multiplayer ? faUsers : faRobot}
                        aria-hidden="true"
                     />
                  </div>
                  <h3>{game.title}</h3>
                  <p className={styles.progress}>{game.progress}</p>
                  <p className={styles.status}>{game.status}</p>
                  {confirming === game.id && (
                     <p className={styles.confirm} role="status">
                        {game.concedeMessage ??
                           "Concede this game? Only finished games count toward your statistics."}
                     </p>
                  )}
                  {actionError?.id === game.id && (
                     <p role="alert">{actionError.message}</p>
                  )}
                  <div className={styles.actions}>
                     <Button
                        name={confirming === game.id ? "Keep game" : "Resume"}
                        size="compact"
                        disabled={!!busy}
                        onClick={() =>
                           confirming === game.id
                              ? setConfirming(null)
                              : void perform(game.id, onResume)
                        }
                     />
                     <Button
                        name={busy === game.id ? "Please wait…" : "Concede"}
                        variant="secondary"
                        size="compact"
                        disabled={!!busy || game.concedeDisabled}
                        onClick={() =>
                           confirming === game.id
                              ? void perform(game.id, onConcede)
                              : setConfirming(game.id)
                        }
                     />
                  </div>
               </article>
            ))}
         </div>
      </section>
   );
}
