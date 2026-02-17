"use client";

import React from "react";

import type { GamePhase, PassDirection } from "@/types/game";
import styles from "@/styles/play.module.css";

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
         {passDirection !== "none" && (
            <span className={styles.playInfoDetail}>
               Pass {passDirection}
            </span>
         )}
         <span className={styles.playInfoPhase}>{phase}</span>
      </div>
   );
};
