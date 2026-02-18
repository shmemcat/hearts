"use client";

import React from "react";

import { Button } from "@/components/Buttons";
import type { GamePhase, PassDirection } from "@/types/game";
import styles from "./InfoModal.module.css";

export interface InfoModalProps {
   round: number;
   passDirection: PassDirection;
   phase: GamePhase;
   players: { name: string; score: number }[];
   onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
   round,
   passDirection,
   phase,
   players,
   onClose,
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

            <div className={styles.scoresGrid}>
               {players.map((p, i) => (
                  <React.Fragment key={i}>
                     <span className={styles.scoreName}>{p.name}</span>
                     <span className={styles.scoreValue}>{p.score}</span>
                  </React.Fragment>
               ))}
            </div>

            <Button name="Close" onClick={onClose} />
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
         <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
         >
            <rect x="2" y="10" width="3" height="6" rx="0.5" />
            <rect x="7.5" y="6" width="3" height="10" rx="0.5" />
            <rect x="13" y="2" width="3" height="14" rx="0.5" />
         </svg>
      </button>
   );
};
