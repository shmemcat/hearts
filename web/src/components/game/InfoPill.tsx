import React from "react";

import type { GamePhase, PassDirection } from "@/types/game";
import styles from "./InfoPill.module.css";

export interface InfoPillProps {
   round: number;
   passDirection: PassDirection;
   phase: GamePhase;
}

export const InfoPill: React.FC<InfoPillProps> = ({
   round,
   passDirection,
   phase,
}) => {
   return (
      <div className={styles.playInfoPill}>
         <span className={styles.playInfoRound}>Round {round}</span>
         <span className={styles.playInfoDetail}>
            {passDirection === "none" ? "No pass" : `Pass ${passDirection}`}
         </span>
         <span className={styles.playInfoPhase}>{phase}</span>
      </div>
   );
};
