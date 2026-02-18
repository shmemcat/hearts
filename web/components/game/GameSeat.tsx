"use client";

import React from "react";

import { useIsMobile } from "@/hooks/useIsMobile";
import styles from "./GameSeat.module.css";

export interface GameSeatProps {
   /** Display name for the player. */
   name: string;
   /** Short label for mobile (e.g. "S", "A1", "G1"). */
   shortName?: string;
   /** Seat index 0-3, used to pick badge color. */
   seatIndex?: number;
   /** Cumulative score for the game. */
   score: number;
   /** Table position. */
   position: "top" | "left" | "right" | "bottom";
   /** Whether this seat has the current turn highlight. */
   isCurrentTurn: boolean;
   /** Show per-round heart counts (only during active play). */
   showHearts: boolean;
   /** Number of hearts won this round so far. */
   heartCount: number;
   /** Hearts won in the trick that just completed (for the pop badge). */
   heartDelta: number;
   /** Stable key for the delta badge animation reset. */
   trickResultId?: string | number;
}

const POSITION_CLASS: Record<GameSeatProps["position"], string> = {
   top: styles.gameTableSeatTop,
   left: styles.gameTableSeatLeft,
   right: styles.gameTableSeatRight,
   bottom: styles.gameTableSeatBottom,
};

export const GameSeat: React.FC<GameSeatProps> = ({
   name,
   shortName,
   seatIndex = 0,
   score,
   position,
   isCurrentTurn,
   showHearts,
   heartCount,
   heartDelta,
   trickResultId,
}) => {
   const isMobile = useIsMobile();

   if (isMobile) {
      const label = shortName ?? name;

      return (
         <div
            className={`${styles.gameTableSeat} ${POSITION_CLASS[position]} ${
               styles.gameTableSeatMobile
            } ${styles.seatMobileRow} ${
               isCurrentTurn ? styles.seatMobileTurn : ""
            }`}
         >
            <span className={styles.seatBadge}>{label}</span>
            {showHearts && (
               <span className={styles.seatMobileHearts}>
                  <span className={styles.seatMobileHeartCount}>
                     {" "}
                     &nbsp;♥ {heartCount}
                  </span>
                  {heartDelta > 0 && (
                     <span
                        key={trickResultId}
                        className={styles.heartDeltaBadge}
                     >
                        +{heartDelta}
                     </span>
                  )}
               </span>
            )}
         </div>
      );
   }

   return (
      <div
         className={`${styles.gameTableSeat} ${POSITION_CLASS[position]} ${
            isCurrentTurn ? styles.gameTableSeatYourTurn : ""
         }`}
      >
         <span className={styles.gameTableSeatName}>{name}</span>
         <span className={styles.gameTableSeatScore}>
            {score}
            {showHearts && (
               <>
                  <span className={styles.seatScoreSep}> · </span>
                  <span className={styles.seatHeartCount}>♥ {heartCount}</span>
               </>
            )}
            {heartDelta > 0 && (
               <span key={trickResultId} className={styles.heartDeltaBadge}>
                  +{heartDelta}
               </span>
            )}
         </span>
      </div>
   );
};
