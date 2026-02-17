"use client";

import React from "react";
import Link from "next/link";

import { Button } from "@/components/buttons";
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
   return (
      <div className={styles.gameOverBlock}>
         <p className={styles.gameOverTitle}>Game Over</p>
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
         <Link href="/game/create">
            <Button
               name="Create New Game"
               style={{
                  width: "250px",
                  marginTop: "16px",
               }}
            />
         </Link>
      </div>
   );
};
