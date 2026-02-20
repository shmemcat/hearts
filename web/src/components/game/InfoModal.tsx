import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartSimple } from "@fortawesome/pro-solid-svg-icons";

import { Button } from "@/components/Buttons";
import type { GamePhase, PassDirection } from "@/types/game";
import styles from "./InfoModal.module.css";

export interface InfoModalProps {
   round: number;
   passDirection: PassDirection;
   phase: GamePhase;
   players: { name: string; score: number }[];
   onClose: () => void;
   onConcede?: () => void;
   gameOver?: boolean;
}

export const InfoModal: React.FC<InfoModalProps> = ({
   round,
   passDirection,
   phase,
   players,
   onClose,
   onConcede,
   gameOver,
}) => {
   return (
      <div className={styles.backdrop} onClick={onClose}>
         <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <span className={styles.title}>Round {round}</span>

            <div className={styles.row}>
               <span className={styles.rowLabel}>
                  {passDirection === "none"
                     ? "No pass"
                     : `Pass ${passDirection}`}
               </span>
            </div>

            <div className={styles.divider} />

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
                           className={p.idx === 0 ? styles.scoreTableYou : ""}
                        >
                           <td>{p.name}</td>
                           <td>{p.score}</td>
                        </tr>
                     ))}
               </tbody>
            </table>

            <Button name="Close" onClick={onClose} />
            {onConcede && !gameOver && (
               <Button
                  name="Concede Game"
                  onClick={() => {
                     onClose();
                     onConcede();
                  }}
               />
            )}
         </div>
      </div>
   );
};

export interface InfoButtonProps {
   onClick: () => void;
}

export const InfoButton: React.FC<InfoButtonProps> = ({ onClick }) => {
   return (
      <button
         type="button"
         className={styles.infoBtn}
         onClick={onClick}
         aria-label="Round info"
      >
         <FontAwesomeIcon icon={faChartSimple} />
      </button>
   );
};
