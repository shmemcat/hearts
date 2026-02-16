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
}

/** Display the current trick. Four positions (you, left, across, right). */
export const Trick: React.FC<TrickProps> = ({ slots, playerNames }) => {
  const labels = playerNames ?? ["You", "Left", "Across", "Right"];

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
