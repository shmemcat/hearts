import React from "react";

import { Card } from "@/components/game/Card";
import { useIsMobile } from "@/hooks/useIsMobile";
import styles from "./Hand.module.css";

const SMOOSH_DURATION_MS = 250;

const CARD_WIDTH = 72;
const INITIAL_OVERLAP = 23.5;
const FULL_HAND = 13;
/** Total px width of a 13-card fan: n*w - 2*o*(n-1). */
const INITIAL_WIDTH =
   FULL_HAND * CARD_WIDTH - 2 * INITIAL_OVERLAP * (FULL_HAND - 1); // 372

/**
 * Compute the exact overlap needed so `count` cards occupy the same total
 * width as the original 13-card fan.  Once the overlap would drop below
 * 40 % of the card width between neighbors, stop expanding and hold there
 * so small hands don't look goofy with too-sparse cards.
 */
const HAND_PADDING = 32; // 16px on each side (from mobile CSS)
const MIN_OVERLAP = CARD_WIDTH * 0.2; // 40 % overlap between neighbors = 20 % per side
function getMobileOverlap(count: number, targetWidth: number): number {
   if (count <= 1) return 0;
   const needed = (CARD_WIDTH * count - targetWidth) / (2 * (count - 1));
   return Math.max(MIN_OVERLAP, needed);
}

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

   const [availableWidth, setAvailableWidth] = React.useState(() =>
      typeof window !== "undefined"
         ? Math.min(INITIAL_WIDTH, window.innerWidth - HAND_PADDING)
         : INITIAL_WIDTH
   );
   React.useEffect(() => {
      if (!isMobile) {
         setAvailableWidth(INITIAL_WIDTH);
         return;
      }
      const update = () => {
         setAvailableWidth(
            Math.min(INITIAL_WIDTH, window.innerWidth - HAND_PADDING)
         );
      };
      update();
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
   }, [isMobile]);
   const targetWidth = isMobile ? availableWidth : INITIAL_WIDTH;

   const sorted = React.useMemo(
      () => [...cards].sort(compareCardCodes),
      [cards]
   );

   /* ── Smoosh: only when there's a genuine mix of legal AND disabled cards ── */
   const hasMix =
      legalCodes !== undefined &&
      legalCodes.size > 0 &&
      sorted.some((c) => !legalCodes.has(c));
   const shouldSmoosh = isMobile && hasMix && onCardClick !== undefined;

   const [smooshLocked, setSmooshLocked] = React.useState(false);
   const prevShouldSmoosh = React.useRef(false);

   React.useEffect(() => {
      if (shouldSmoosh && !prevShouldSmoosh.current) {
         setSmooshLocked(true);
         const id = setTimeout(
            () => setSmooshLocked(false),
            SMOOSH_DURATION_MS
         );
         prevShouldSmoosh.current = shouldSmoosh;
         return () => clearTimeout(id);
      }
      prevShouldSmoosh.current = shouldSmoosh;
   }, [shouldSmoosh]);

   /* ── Mobile overlap + smoosh margins ──────────────────────────────────── */
   const baseOverlap = isMobile
      ? getMobileOverlap(sorted.length, targetWidth)
      : 0;

   const nLegal = legalCodes
      ? sorted.filter((c) => legalCodes.has(c)).length
      : 0;
   const nDisabled = sorted.length - nLegal;

   /*
    * Smoosh overlaps: redistribute margin budget from disabled → legal cards
    * so legal cards expose ~35 % more face while total width stays constant.
    *   legalOverlap    = base × (1 - SPREAD)
    *   disabledOverlap = base × (1 + nLegal × SPREAD / nDisabled)
    * Cap the disabled overlap so cards never disappear entirely.
    */
   const LEGAL_SPREAD = 0.35;
   const MAX_DISABLED_OVERLAP = CARD_WIDTH * 0.75;
   const legalOverlap = baseOverlap * (1 - LEGAL_SPREAD);
   const disabledOverlap =
      nDisabled > 0
         ? Math.min(
              baseOverlap * (1 + (nLegal * LEGAL_SPREAD) / nDisabled),
              MAX_DISABLED_OVERLAP
           )
         : baseOverlap;

   /* ── Per-card overlaps with screen-width clamping ────────────────────── */
   const cardOverlaps = sorted.map((code) => {
      if (!isMobile || legalCodes === undefined) return baseOverlap;
      if (!shouldSmoosh) return baseOverlap;
      const isDisabled = legalCodes.size > 0 && !legalCodes.has(code);
      return isDisabled ? disabledOverlap : legalOverlap;
   });

   if (isMobile && sorted.length > 1) {
      const sum = cardOverlaps.reduce((s, v) => s + v, 0);
      let totalWidth =
         sorted.length * CARD_WIDTH -
         2 * sum +
         cardOverlaps[0] +
         cardOverlaps[sorted.length - 1];
      if (totalWidth > targetWidth) {
         const delta = (totalWidth - targetWidth) / (2 * (sorted.length - 1));
         for (let i = 0; i < cardOverlaps.length; i++) {
            cardOverlaps[i] += delta;
         }
         totalWidth = targetWidth;
      }

      /*
       * Edge cards only lose overlap on one side (outer margin is zeroed by
       * CSS), so they need a lower overlap cap to keep rank + suit readable.
       * If capping the edge frees up width, redistribute to interior cards.
       */
      const MIN_EDGE_VISIBLE = 36;
      const maxEdgeOverlap = CARD_WIDTH - MIN_EDGE_VISIBLE;
      const last = sorted.length - 1;
      let freed = 0;
      for (const idx of [0, last]) {
         if (cardOverlaps[idx] > maxEdgeOverlap) {
            freed += cardOverlaps[idx] - maxEdgeOverlap;
            cardOverlaps[idx] = maxEdgeOverlap;
         }
      }
      if (freed > 0 && sorted.length > 2) {
         const interiorCount = sorted.length - 2;
         const extra = freed / (2 * interiorCount);
         for (let i = 1; i < last; i++) {
            cardOverlaps[i] += extra;
         }
      }
   }

   /* Subtle arc: slight rotation + parabolic vertical offset for a gentle curve. */
   const centerIndex = (sorted.length - 1) / 2;
   const degPerCard = 1.2;
   const arcFactor = isMobile ? 0.2 : 0.5;

   const wrap = (
      code: string,
      index: number,
      card: React.ReactNode,
      isDisabled?: boolean
   ) => {
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

      let transform = `translateY(${translateY}px) rotate(${rotation}deg)`;
      const inlineStyle: React.CSSProperties = {};

      if (isMobile && legalCodes !== undefined) {
         const overlap = cardOverlaps[index];
         if (shouldSmoosh && isDisabled) {
            transform += " scale(0.8)";
         }
         inlineStyle.margin = `0 -${overlap}px`;
      }

      inlineStyle.transform = transform;

      return (
         <div key={code} className={styles.handCardWrap} style={inlineStyle}>
            {content}
         </div>
      );
   };

   const effectiveOnCardClick = smooshLocked ? undefined : onCardClick;

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
            {sorted.map((code, i) => {
               const disabled = legalCodes.size > 0 && !legalCodes.has(code);
               return wrap(
                  code,
                  i,
                  <Card
                     code={code}
                     disabled={disabled}
                     onClick={
                        effectiveOnCardClick
                           ? () => effectiveOnCardClick(code)
                           : undefined
                     }
                     size={size}
                  />,
                  disabled
               );
            })}
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
