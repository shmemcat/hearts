"use client";

import React from "react";

import { Card } from "@/components/game/Card";
import type { CurrentTrickSlot } from "@/types/game";
import styles from "@/styles/play.module.css";

export interface TrickProps {
  /** current_trick from state: [slot0, slot1, slot2, slot3], null = no card. */
  slots: CurrentTrickSlot[];
  /** Player names for labels (optional). */
  playerNames?: string[];
  /** "table" = slots at bottom/top/left/right around center (0=bottom, 1=top, 2=left, 3=right). */
  layout?: "row" | "table";
  /** When layout=table, optional icon in center (e.g. hearts broken). */
  centerIcon?: React.ReactNode;
}

const TABLE_SLOT_ORDER: Array<{ index: number; className: string }> = [
  { index: 0, className: styles.trickTableSlotBottom },
  { index: 1, className: styles.trickTableSlotTop },
  { index: 2, className: styles.trickTableSlotLeft },
  { index: 3, className: styles.trickTableSlotRight },
];

/** Display the current trick. Four positions (0=bottom, 1=top, 2=left, 3=right). */
export const Trick: React.FC<TrickProps> = ({
  slots,
  playerNames,
  layout = "row",
  centerIcon,
}) => {
  const labels = playerNames ?? ["You", "Top", "Left", "Right"];

  if (layout === "table") {
    return (
      <div className={styles.trickTable} role="region" aria-label="Current trick">
        {TABLE_SLOT_ORDER.map(({ index, className }) => {
          const slot = slots[index];
          return (
            <div key={index} className={`${styles.trickTableSlot} ${className}`}>
              {slot ? (
                <Card code={slot.card} size="medium" />
              ) : (
                <div className={styles.trickSlotEmpty} aria-hidden="true" />
              )}
            </div>
          );
        })}
        {centerIcon && (
          <div className={styles.trickTableCenterIcon} aria-hidden="true">
            {centerIcon}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.trick} role="region" aria-label="Current trick">
      {slots.map((slot, i) => (
        <div key={i} className={styles.trickSlot}>
          <span className={styles.trickSlotLabel}>{labels[i]}</span>
          {slot ? (
            <Card code={slot.card} size="small" />
          ) : (
            <div className={styles.trickSlotEmpty} aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
};
