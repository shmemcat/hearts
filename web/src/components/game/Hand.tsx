import React from "react";

import { Card } from "@/components/game/Card";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileLayout } from "@/context/MobileLayoutContext";
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
const MIN_OVERLAP = CARD_WIDTH * 0.17; // 40 % overlap between neighbors = 20 % per side
const DOUBLE_ROW_THRESHOLD = 7;

function getMobileOverlap(count: number, targetWidth: number): number {
   if (count <= 1) return 0;
   const needed = (CARD_WIDTH * count - targetWidth) / (2 * (count - 1));
   return Math.max(MIN_OVERLAP, needed);
}

/** Clamp per-card overlaps so total width fits targetWidth and edge cards stay readable. */
function clampRowOverlaps(overlaps: number[], targetWidth: number): void {
   const n = overlaps.length;
   if (n <= 1) return;
   const sum = overlaps.reduce((s, v) => s + v, 0);
   let totalWidth = n * CARD_WIDTH - 2 * sum + overlaps[0] + overlaps[n - 1];
   if (totalWidth > targetWidth) {
      const delta = (totalWidth - targetWidth) / (2 * (n - 1));
      for (let i = 0; i < n; i++) overlaps[i] += delta;
      totalWidth = targetWidth;
   }
   const MIN_EDGE_VISIBLE = 36;
   const maxEdgeOverlap = CARD_WIDTH - MIN_EDGE_VISIBLE;
   const last = n - 1;
   let freed = 0;
   for (const idx of [0, last]) {
      if (overlaps[idx] > maxEdgeOverlap) {
         freed += overlaps[idx] - maxEdgeOverlap;
         overlaps[idx] = maxEdgeOverlap;
      }
   }
   if (freed > 0 && n > 2) {
      const extra = freed / (2 * (n - 2));
      for (let i = 1; i < last; i++) overlaps[i] += extra;
   }
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
   const { mobileLayout } = useMobileLayout();

   const [screenWidth, setScreenWidth] = React.useState(() =>
      typeof window !== "undefined"
         ? window.innerWidth - HAND_PADDING
         : INITIAL_WIDTH
   );
   React.useEffect(() => {
      if (!isMobile) return;
      const update = () => {
         setScreenWidth(window.innerWidth - HAND_PADDING);
      };
      update();
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
   }, [isMobile]);
   const targetWidth = isMobile
      ? Math.min(INITIAL_WIDTH, screenWidth)
      : INITIAL_WIDTH;

   const sorted = React.useMemo(
      () => [...cards].sort(compareCardCodes),
      [cards]
   );

   const useTwoRows =
      isMobile &&
      mobileLayout === "double" &&
      sorted.length > DOUBLE_ROW_THRESHOLD;

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

   /* ── Two-row mobile layout (8+ cards) ──────────────────────────────── */
   if (useTwoRows) {
      const splitIdx = Math.floor(sorted.length / 2);
      const backCards = sorted.slice(0, splitIdx);
      const frontCards = sorted.slice(splitIdx);

      const twoRowOverlap = (count: number) => {
         if (count <= 1) return 0;
         const needed = (CARD_WIDTH * count - screenWidth) / (2 * (count - 1));
         return Math.max(0, needed);
      };

      const backOverlaps = backCards.map(() => twoRowOverlap(backCards.length));
      clampRowOverlaps(backOverlaps, screenWidth);

      const frontOverlaps = frontCards.map(() =>
         twoRowOverlap(frontCards.length)
      );
      clampRowOverlaps(frontOverlaps, screenWidth);

      const wrapTwo = (
         code: string,
         index: number,
         overlaps: number[],
         rowLen: number,
         card: React.ReactNode
      ) => {
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

         const center = (rowLen - 1) / 2;
         const dist = index - center;
         const rotation = dist * 0.8;
         const yOff = Math.pow(Math.abs(dist), 2) * 0.15;

         return (
            <div
               key={code}
               className={styles.handCardWrap}
               style={{
                  margin: `0 -${overlaps[index]}px`,
                  transform: `translateY(${yOff}px) rotate(${rotation}deg)`,
               }}
            >
               {content}
            </div>
         );
      };

      const renderRow = (
         rowCards: string[],
         overlaps: number[],
         className: string
      ) => (
         <div className={className}>
            {rowCards.map((code, i) => {
               if (selectionMode && selectedCodes) {
                  return wrapTwo(
                     code,
                     i,
                     overlaps,
                     rowCards.length,
                     <Card
                        code={code}
                        selected={selectedCodes.has(code)}
                        onClick={() => onCardClick?.(code)}
                        size={size}
                     />
                  );
               }
               if (legalCodes !== undefined) {
                  const disabled = legalCodes.size > 0 && !legalCodes.has(code);
                  return wrapTwo(
                     code,
                     i,
                     overlaps,
                     rowCards.length,
                     <Card
                        code={code}
                        disabled={disabled}
                        onClick={
                           onCardClick ? () => onCardClick(code) : undefined
                        }
                        size={size}
                     />
                  );
               }
               return wrapTwo(
                  code,
                  i,
                  overlaps,
                  rowCards.length,
                  <Card code={code} size={size} />
               );
            })}
         </div>
      );

      return (
         <div className={styles.handTwoRow} role="group" aria-label="Your hand">
            {renderRow(backCards, backOverlaps, styles.handBackRow)}
            {renderRow(frontCards, frontOverlaps, styles.handFrontRow)}
         </div>
      );
   }

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
      clampRowOverlaps(cardOverlaps, targetWidth);
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
