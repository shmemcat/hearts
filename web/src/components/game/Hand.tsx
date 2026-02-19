import React from "react";

import { Card } from "@/components/game/Card";
import { useIsMobile } from "@/hooks/useIsMobile";
import styles from "./Hand.module.css";

export interface HandProps {
   cards: string[];
   /** For passing: which card codes are selected (max 3). */
   selectedCodes?: Set<string>;
   /** For playing: which codes are legal to play. If set, only these are clickable. */
   legalCodes?: Set<string>;
   onCardClick?: (code: string) => void;
   /** When true, cards are selectable for pass (toggle up to 3). */
   selectionMode?: boolean;
   size?: "normal" | "medium";
   /** Cards animating out of hand (pass transition). */
   exitingCodes?: Set<string>;
   exitDirection?: "left" | "right" | "up";
   /** Cards animating into hand (pass transition). */
   enteringCodes?: Set<string>;
   enterDirection?: "left" | "right" | "above";
}

export const Hand: React.FC<HandProps> = ({
   cards,
   selectedCodes,
   legalCodes,
   onCardClick,
   selectionMode = false,
   size = "normal",
   exitingCodes,
   exitDirection,
   enteringCodes,
   enterDirection,
}) => {
   const isMobile = useIsMobile();
   const sorted = React.useMemo(
      () => [...cards].sort(compareCardCodes),
      [cards]
   );

   /* Subtle arc: slight rotation + parabolic vertical offset for a gentle curve. */
   const centerIndex = (sorted.length - 1) / 2;
   const degPerCard = 1.2;
   const arcFactor = isMobile ? 0.2 : 0.5;
   const wrap = (code: string, index: number, card: React.ReactNode) => {
      const distance = index - centerIndex;
      const rotation = distance * degPerCard;
      const translateY = Math.pow(Math.abs(distance), 2) * arcFactor;

      let content = card;
      if (exitingCodes?.has(code) && exitDirection) {
         const cls =
            exitDirection === "left"
               ? styles.handExitLeft
               : exitDirection === "right"
               ? styles.handExitRight
               : styles.handExitUp;
         content = <div className={cls}>{card}</div>;
      } else if (enteringCodes?.has(code) && enterDirection) {
         const cls =
            enterDirection === "left"
               ? styles.handEnterFromLeft
               : enterDirection === "right"
               ? styles.handEnterFromRight
               : styles.handEnterFromAbove;
         content = <div className={cls}>{card}</div>;
      }

      return (
         <div
            key={code}
            className={styles.handCardWrap}
            style={{
               transform: `translateY(${translateY}px) rotate(${rotation}deg)`,
            }}
         >
            {content}
         </div>
      );
   };

   if (selectionMode && selectedCodes) {
      return (
         <div className={styles.hand} role="group" aria-label="Your hand">
            {sorted.map((code, i) =>
               wrap(
                  code,
                  i,
                  <Card
                     code={code}
                     selected={selectedCodes.has(code)}
                     onClick={() => onCardClick?.(code)}
                     size={size}
                  />
               )
            )}
         </div>
      );
   }

   if (legalCodes !== undefined) {
      return (
         <div className={styles.hand} role="group" aria-label="Your hand">
            {sorted.map((code, i) =>
               wrap(
                  code,
                  i,
                  <Card
                     code={code}
                     disabled={!legalCodes.has(code)}
                     onClick={onCardClick ? () => onCardClick(code) : undefined}
                     size={size}
                  />
               )
            )}
         </div>
      );
   }

   return (
      <div className={styles.hand} role="group" aria-label="Your hand">
         {sorted.map((code, i) =>
            wrap(code, i, <Card code={code} size={size} />)
         )}
      </div>
   );
};

/** Sort by suit (c,d,s,h) then rank A→2 (high to low). */
function compareCardCodes(a: string, b: string): number {
   const suitOrder: Record<string, number> = { c: 0, d: 1, s: 2, h: 3 };
   const aSuit = a.slice(-1).toLowerCase();
   const bSuit = b.slice(-1).toLowerCase();
   if (suitOrder[aSuit] !== suitOrder[bSuit]) {
      return suitOrder[aSuit] - suitOrder[bSuit];
   }
   const rankOrder: Record<string, number> = {
      "2": 2,
      "3": 3,
      "4": 4,
      "5": 5,
      "6": 6,
      "7": 7,
      "8": 8,
      "9": 9,
      "10": 10,
      "J": 11,
      "Q": 12,
      "K": 13,
      "A": 14,
   };
   const aRank = a.slice(0, -1);
   const bRank = b.slice(0, -1);
   return (rankOrder[bRank] ?? 0) - (rankOrder[aRank] ?? 0);
}
