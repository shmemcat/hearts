import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import party from "party-js";

import { Button } from "@/components/Buttons";
import type { GamePlayer } from "@/types/game";
import styles from "@/styles/play.module.css";

export interface GameOverBlockProps {
   players: GamePlayer[];
   winnerIndex: number | null;
}

export const GameOverBlock: React.FC<GameOverBlockProps> = ({
   players,
   winnerIndex,
}) => {
   const humanWon = winnerIndex === 0;
   const confettiRef = useRef<HTMLParagraphElement>(null);

   useEffect(() => {
      if (!humanWon) return;
      const timer = setTimeout(() => {
         if (confettiRef.current) {
            party.confetti(confettiRef.current, {
               count: party.variation.range(80, 140),
            });
         }
      }, 100);
      return () => clearTimeout(timer);
   }, [humanWon]);

   return (
      <div className={styles.gameOverBackdrop}>
         <div className={styles.gameOverBlock}>
            <p ref={confettiRef} className={styles.gameOverTitle}>
               {humanWon ? "You won!" : "Game Over"}
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
                     .map((p) => (
                        <tr
                           key={p.idx}
                           className={
                              p.idx === winnerIndex
                                 ? styles.scoreTableWinner
                                 : ""
                           }
                        >
                           <td>{p.name}</td>
                           <td>{p.score}</td>
                        </tr>
                     ))}
               </tbody>
            </table>
            <Link to="/game/create">
               <Button
                  name="Create New Game"
                  style={{ width: "250px" }}
               />
            </Link>
         </div>
      </div>
   );
};
