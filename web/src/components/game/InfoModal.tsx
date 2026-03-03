import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartSimple } from "@fortawesome/pro-solid-svg-icons";

import { Button } from "@/components/Buttons";
import { PlayerIcon } from "./PlayerIcon";
import type { PassDirection } from "@/types/game";
import styles from "./InfoModal.module.css";

const DIFFICULTY_LABELS: Record<string, string> = {
   easy: "Easy",
   medium: "Medium",
   hard: "Hard",
   harder: "Harder",
   hardest: "Hardest",
};

export interface InfoModalProps {
   round: number;
   passDirection: PassDirection;
   difficulty?: string;
   difficultyPrefix?: string;
   players: { name: string; score: number; icon?: string }[];
   mySeatIndex?: number;
   onClose: () => void;
   onConcede?: () => void;
   gameOver?: boolean;
}

export const InfoModal: React.FC<InfoModalProps> = ({
   round,
   passDirection,
   difficulty,
   difficultyPrefix,
   players,
   mySeatIndex = 0,
   onClose,
   onConcede,
   gameOver,
}) => {
   const difficultyLabel = difficulty
      ? DIFFICULTY_LABELS[difficulty] ?? difficulty
      : null;

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
               {difficultyLabel && (
                  <>
                     <span className={styles.rowSep}>·</span>
                     <span className={styles.rowLabel}>
                        {difficultyPrefix ? `${difficultyPrefix}: ` : ""}
                        {difficultyLabel}
                     </span>
                  </>
               )}
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
                           className={
                              p.idx === mySeatIndex ? styles.scoreTableYou : ""
                           }
                        >
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
