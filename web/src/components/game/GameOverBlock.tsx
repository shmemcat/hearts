import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import party from "party-js";

import { Button } from "@/components/Buttons";
import { PlayerIcon } from "./PlayerIcon";
import type { GamePlayer } from "@/types/game";
import styles from "@/styles/play.module.css";

export interface GameOverBlockProps {
   players: GamePlayer[];
   winnerIndex: number | null;
   mySeatIndex?: number;
   children?: React.ReactNode;
}

export const GameOverBlock: React.FC<GameOverBlockProps> = ({
   players,
   winnerIndex,
   mySeatIndex = 0,
   children,
}) => {
   const isTie = winnerIndex === -1;
   const winnerName =
      winnerIndex != null && winnerIndex >= 0
         ? players[winnerIndex]?.name
         : null;
   const myWon = winnerIndex === mySeatIndex;
   const confettiRef = useRef<HTMLParagraphElement>(null);

   useEffect(() => {
      if (!myWon) return;
      const timer = setTimeout(() => {
         if (confettiRef.current) {
            party.confetti(confettiRef.current, {
               count: party.variation.range(80, 140),
            });
         }
      }, 100);
      return () => clearTimeout(timer);
   }, [myWon]);

   const title = isTie
      ? "It's a tie!"
      : myWon
      ? "You won!"
      : winnerName
      ? `${winnerName} won!`
      : "Game Over";

   const minScore = isTie ? Math.min(...players.map((p) => p.score)) : null;

   return (
      <div className={styles.gameOverBackdrop}>
         <div className={styles.gameOverBlock}>
            <p ref={confettiRef} className={styles.gameOverTitle}>
               {title}
            </p>
            <table className={styles.scoreTable}>
               <thead>
                  <tr>
                     <th>Player</th>
                     <th>Score</th>
                  </tr>
               </thead>
               <tbody>
                  {[...players]
                     .map((p, i) => ({ ...p, idx: i }))
                     .sort((a, b) => a.score - b.score)
                     .map((p) => {
                        const isMe = p.idx === mySeatIndex;
                        const isTiedWinner = isTie && p.score === minScore;
                        const classes = [
                           isMe ? styles.scoreTableMe : "",
                           isTiedWinner ? styles.scoreTableWinner : "",
                        ]
                           .filter(Boolean)
                           .join(" ");
                        return (
                           <tr key={p.idx} className={classes}>
                              <td>
                                 <PlayerIcon
                                    name={p.name}
                                    icon={p.icon}
                                    size={13}
                                 />{" "}
                                 {p.name}
                              </td>
                              <td>{p.score}</td>
                           </tr>
                        );
                     })}
               </tbody>
            </table>
            {children ?? (
               <Link to="/game/create">
                  <Button name="Create New Game" style={{ width: "250px" }} />
               </Link>
            )}
         </div>
      </div>
   );
};
