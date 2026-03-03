import React from "react";

import type { PassDirection } from "@/types/game";
import styles from "./InfoPill.module.css";

const DIFFICULTY_LABELS: Record<string, string> = {
   easy: "Easy",
   medium: "Medium",
   hard: "Hard",
   harder: "Harder",
   hardest: "Hardest",
};

export interface InfoPillProps {
   round: number;
   passDirection: PassDirection;
   difficulty?: string;
   difficultyPrefix?: string;
}

export const InfoPill: React.FC<InfoPillProps> = ({
   round,
   passDirection,
   difficulty,
   difficultyPrefix,
}) => {
   const difficultyLabel = difficulty
      ? DIFFICULTY_LABELS[difficulty] ?? difficulty
      : null;

   return (
      <div className={styles.playInfoPill}>
         <span className={styles.playInfoRound}>Round {round}</span>
         <span className={styles.playInfoDetail}>
            {passDirection === "none" ? "No pass" : `Pass ${passDirection}`}
         </span>
         {difficultyLabel && (
            <span className={styles.playInfoDifficulty}>
               {difficultyPrefix ? `${difficultyPrefix}: ` : ""}
               {difficultyLabel}
            </span>
         )}
      </div>
   );
};
