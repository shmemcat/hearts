"use client";

import React from "react";

import { Button } from "@/components/Buttons";
import styles from "@/styles/play.module.css";

export interface RoundSummaryData {
   deltas: number[];
   round: number;
   players: { name: string; score: number }[];
}

export interface RoundSummaryOverlayProps {
   summary: RoundSummaryData;
   onContinue: () => void;
}

export const RoundSummaryOverlay: React.FC<RoundSummaryOverlayProps> = ({
   summary,
   onContinue,
}) => {
   return (
      <div className={styles.roundSummaryOverlay}>
         <div className={styles.roundSummaryBlock}>
            <p className={styles.roundSummaryTitle}>
               Round {summary.round} Complete
            </p>
            <table className={styles.scoreTable}>
               <thead>
                  <tr>
                     <th>Player</th>
                     <th>This Round</th>
                     <th>Total</th>
                  </tr>
               </thead>
               <tbody>
                  {summary.players.map((p, i) => (
                     <tr key={i}>
                        <td>{p.name}</td>
                        <td className={styles.scoreDelta}>
                           {summary.deltas[i] > 0
                              ? `+${summary.deltas[i]}`
                              : "0"}
                        </td>
                        <td>{p.score}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
            <Button
               name="Continue"
               onClick={onContinue}
               style={{ width: "180px", marginTop: "16px" }}
            />
         </div>
      </div>
   );
};
