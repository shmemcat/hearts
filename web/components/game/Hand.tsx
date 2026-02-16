"use client";

import React from "react";

import { Card } from "@/components/game/Card";
import styles from "@/styles/play.module.css";

export interface HandProps {
  cards: string[];
  /** For passing: which card codes are selected (max 3). */
  selectedCodes?: Set<string>;
  /** For playing: which codes are legal to play. If set, only these are clickable. */
  legalCodes?: Set<string>;
  onCardClick?: (code: string) => void;
  /** When true, cards are selectable for pass (toggle up to 3). */
  selectionMode?: boolean;
  size?: "normal" | "small";
}

export const Hand: React.FC<HandProps> = ({
  cards,
  selectedCodes,
  legalCodes,
  onCardClick,
  selectionMode = false,
  size = "normal",
}) => {
  const sorted = React.useMemo(() => [...cards].sort(compareCardCodes), [cards]);

  if (selectionMode && selectedCodes) {
    return (
      <div className={styles.hand} role="group" aria-label="Your hand">
        {sorted.map((code) => (
          <Card
            key={code}
            code={code}
            selected={selectedCodes.has(code)}
            onClick={() => onCardClick?.(code)}
            size={size}
          />
        ))}
      </div>
    );
  }

  if (legalCodes !== undefined) {
    return (
      <div className={styles.hand} role="group" aria-label="Your hand">
        {sorted.map((code) => (
          <Card
            key={code}
            code={code}
            disabled={!legalCodes.has(code)}
            onClick={onCardClick ? () => onCardClick(code) : undefined}
            size={size}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.hand} role="group" aria-label="Your hand">
      {sorted.map((code) => (
        <Card key={code} code={code} size={size} />
      ))}
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
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
    "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
  };
  const aRank = a.slice(0, -1);
  const bRank = b.slice(0, -1);
  return (rankOrder[bRank] ?? 0) - (rankOrder[aRank] ?? 0);
}
