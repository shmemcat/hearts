import React, { useRef, useEffect, useCallback } from "react";

import { Card } from "@/components/game/Card";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { CurrentTrickSlot } from "@/types/game";
import styles from "./Trick.module.css";

export interface TrickProps {
  /** Slots in play order: [0]=1st (bottom), [1]=2nd (left), [2]=3rd (top), [3]=4th (right). null = no card. */
  slots: CurrentTrickSlot[];
  /** Player names for labels (optional). */
  playerNames?: string[];
  /** "table" = slots in play order at bottom/left/top/right (0=bottom, 1=left, 2=top, 3=right). */
  layout?: "row" | "table";
  /** When layout=table, optional icon in center (e.g. hearts broken). */
  centerIcon?: React.ReactNode;
  /** When set, cards sweep toward this player slot (0=bottom, 1=left, 2=top, 3=right). */
  collectTarget?: number | null;
  /** When layout=table, optional labels rendered above each slot (indexed same as slots). */
  slotLabels?: (React.ReactNode | null)[];
}

/** Slots in play order: 0=bottom (1st play), 1=left (2nd), 2=top (3rd), 3=right (4th). Layout fixed; all slots clear on Hand Resolves. */
const TABLE_SLOT_ORDER: Array<{ index: number; className: string }> = [
  { index: 0, className: styles.trickTableSlotBottom },
  { index: 1, className: styles.trickTableSlotLeft },
  { index: 2, className: styles.trickTableSlotTop },
  { index: 3, className: styles.trickTableSlotRight },
];

import { COLLECT_DURATION } from "@/lib/constants";

type Endpoint = { x: number; y: number; midX?: number; midY?: number };

/**
 * For each source slot, returns the translate endpoint (and optional arc
 * midpoint) that sweeps toward the winner's trick slot.
 *
 * Slot centers relative to the trickTable center:
 *   bottom (0, +95)  top (0, -95)  left (-102, 0)  right (+102, 0)
 *
 * Same-slot: fade in place (winner's own card).
 * Opposite: long straight translate.
 * Diagonal: 3-point keyframes — midpoint biased toward the cross-axis
 * so the card arcs inward before swooping to the target slot.
 */
function getCollectEndpoints(target: number, scale = 1): Record<number, Endpoint> {
  const s = scale;
  switch (target) {
    case 0:
      return {
        0: { x: 0, y: 0 },
        2: { x: 0, y: 190 * s },
        1: { x: 102 * s, y: 95 * s, midX: 61 * s, midY: 24 * s },
        3: { x: -102 * s, y: 95 * s, midX: -61 * s, midY: 24 * s },
      };
    case 2:
      return {
        2: { x: 0, y: 0 },
        0: { x: 0, y: -190 * s },
        1: { x: 102 * s, y: -95 * s, midX: 61 * s, midY: -24 * s },
        3: { x: -102 * s, y: -95 * s, midX: -61 * s, midY: -24 * s },
      };
    case 1:
      return {
        1: { x: 0, y: 0 },
        3: { x: -204 * s, y: 0 },
        0: { x: -102 * s, y: -95 * s, midX: -26 * s, midY: -57 * s },
        2: { x: -102 * s, y: 95 * s, midX: -26 * s, midY: 57 * s },
      };
    case 3:
      return {
        3: { x: 0, y: 0 },
        1: { x: 204 * s, y: 0 },
        0: { x: 102 * s, y: -95 * s, midX: 26 * s, midY: -57 * s },
        2: { x: 102 * s, y: 95 * s, midX: 26 * s, midY: 57 * s },
      };
    default:
      return {};
  }
}

/** Display the current trick. Four positions in play order: bottom, left, top, right. */
export const Trick: React.FC<TrickProps> = ({
  slots,
  playerNames,
  layout = "row",
  centerIcon,
  collectTarget,
  slotLabels,
}) => {
  const isMobile = useIsMobile();
  const labels = playerNames ?? ["You", "Top", "Left", "Right"];
  const cardRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const collectAnimsRef = useRef<Animation[]>([]);

  const setCardRef = useCallback((index: number, el: HTMLDivElement | null) => {
    const prev = cardRefs.current[index];
    if (prev && prev !== el) {
      prev.getAnimations().forEach((a) => a.cancel());
    }
    cardRefs.current[index] = el;
  }, []);

  useEffect(() => {
    collectAnimsRef.current.forEach((a) => a.cancel());
    collectAnimsRef.current = [];

    if (collectTarget == null) return;
    const endpoints = getCollectEndpoints(collectTarget, isMobile ? 0.8 : 1);

    for (let i = 0; i < 4; i++) {
      const el = cardRefs.current[i];
      const ep = endpoints[i];
      if (!el || !ep) continue;

      const keyframes: Keyframe[] =
        ep.midX != null
          ? [
              { opacity: 1, transform: "translate(0, 0)" },
              {
                opacity: 0.5,
                transform: `translate(${ep.midX}px, ${ep.midY}px)`,
                offset: 0.4,
              },
              { opacity: 0, transform: `translate(${ep.x}px, ${ep.y}px)` },
            ]
          : [
              { opacity: 1, transform: "translate(0, 0)" },
              { opacity: 0, transform: `translate(${ep.x}px, ${ep.y}px)` },
            ];

      collectAnimsRef.current.push(
        el.animate(keyframes, {
          duration: COLLECT_DURATION,
          easing: "ease-in",
          fill: "forwards",
        }),
      );
    }

    return () => {
      collectAnimsRef.current.forEach((a) => a.cancel());
      collectAnimsRef.current = [];
    };
  }, [collectTarget, isMobile]);

  if (layout === "table") {
    return (
      <div className={styles.trickTable} role="region" aria-label="Current trick">
        {TABLE_SLOT_ORDER.map(({ index, className }) => {
          const slot = slots[index];
          return (
            <div key={index} className={`${styles.trickTableSlot} ${className}`}>
              {slotLabels?.[index] && (
                <div className={styles.trickTableSlotLabel}>{slotLabels[index]}</div>
              )}
              <div className={styles.trickSlotEmpty} aria-hidden="true" />
              {slot && (
                <div
                  key={slot.card}
                  ref={(el) => { setCardRef(index, el); }}
                  className={styles.trickSlotCard}
                >
                  <Card code={slot.card} size={isMobile ? "large" : "medium"} />
                </div>
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
            <Card code={slot.card} size="medium" />
          ) : (
            <div className={styles.trickSlotEmpty} aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
};
