import React from "react";

import { GameSeat } from "@/components/game/GameSeat";
import type { GameSeatProps } from "@/components/game/GameSeat";
import { Trick } from "@/components/game/Trick";
import type { CurrentTrickSlot } from "@/types/game";
import styles from "./MobileGameTable.module.css";

export interface MobileGameTableProps {
   seats: [GameSeatProps, GameSeatProps, GameSeatProps, GameSeatProps];
   trickSlots: CurrentTrickSlot[];
   collectTarget?: number | null;
   playerNames?: string[];
   centerIcon?: React.ReactNode;
}

const SEAT_POSITION_CLASS: Record<string, string> = {
   top: styles.seatTop,
   left: styles.seatLeft,
   right: styles.seatRight,
   bottom: styles.seatBottom,
};

export const MobileGameTable: React.FC<MobileGameTableProps> = ({
   seats,
   trickSlots,
   collectTarget,
   playerNames,
   centerIcon,
}) => {
   return (
      <div className={styles.container}>
         {seats.map((seat, i) => (
            <div key={i} className={SEAT_POSITION_CLASS[seat.position]}>
               <GameSeat {...seat} />
            </div>
         ))}

         <div className={styles.trickCenter}>
            <Trick
               layout="table"
               slots={trickSlots}
               collectTarget={collectTarget}
               playerNames={playerNames}
               centerIcon={centerIcon}
            />
         </div>
      </div>
   );
};
