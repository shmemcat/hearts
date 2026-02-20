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
   bottom: styles.seatBottom,
};

const SLOT_INDEX_BY_POSITION: Record<string, number> = {
   bottom: 0,
   left: 1,
   top: 2,
   right: 3,
};

export const MobileGameTable: React.FC<MobileGameTableProps> = ({
   seats,
   trickSlots,
   collectTarget,
   playerNames,
   centerIcon,
}) => {
   const slotLabels: (React.ReactNode | null)[] = [null, null, null, null];

   return (
      <div className={styles.container}>
         {seats.map((seat, i) => {
            if (seat.position === "left" || seat.position === "right") {
               slotLabels[SLOT_INDEX_BY_POSITION[seat.position]] = (
                  <GameSeat key={i} {...seat} />
               );
               return null;
            }
            return (
               <div key={i} className={SEAT_POSITION_CLASS[seat.position]}>
                  <GameSeat {...seat} />
               </div>
            );
         })}

         <div className={styles.trickCenter}>
            <Trick
               layout="table"
               slots={trickSlots}
               collectTarget={collectTarget}
               playerNames={playerNames}
               centerIcon={centerIcon}
               slotLabels={slotLabels}
            />
         </div>
      </div>
   );
};
