import { useCallback, useRef, useState } from "react";
import type { CurrentTrickSlot, PlayEvent } from "@/types/game";

/** How long all 4 cards are shown before the collect sweep begins. */
const HOLD_MS = 1000;
/** Delay before each queued card reveal (turn highlight → card appears). */
const CARD_DELAY_MS = 500;
/** Duration of the collect-to-winner sweep animation (matches Trick.tsx COLLECT_DURATION + buffer). */
const COLLECT_MS = 450;
/** Extra time the heart-delta badge lingers after the sweep finishes (total badge = COLLECT_MS + BADGE_LINGER_MS). */
const BADGE_LINGER_MS = 550;
/** Duration of the empty-board flash between tricks. */
const CLEAR_MS = 300;

/* ── Client-side trick winner detection ──────────────────────────────── */

const RANK_ORDER: Record<string, number> = {
   "2": 2,
   "3": 3,
   "4": 4,
   "5": 5,
   "6": 6,
   "7": 7,
   "8": 8,
   "9": 9,
   "10": 10,
   J: 11,
   Q: 12,
   K: 13,
   A: 14,
};

function cardSuit(code: string): string {
   return code.slice(-1).toLowerCase();
}

function cardRankValue(code: string): number {
   return RANK_ORDER[code.slice(0, -1)] ?? 0;
}

/**
 * Compute trick winner (highest card of lead suit) and heart-card count.
 * The first entry in `plays` is the lead; only cards matching the lead suit
 * compete for winner.
 */
function computeTrickResult(
   plays: PlayEvent[]
): { winner: number; hearts: number } | null {
   if (plays.length < 4) return null;
   const leadSuit = cardSuit(plays[0].card);
   let winner = plays[0];
   let bestRank = cardRankValue(plays[0].card);
   for (let i = 1; i < plays.length; i++) {
      if (cardSuit(plays[i].card) === leadSuit) {
         const rank = cardRankValue(plays[i].card);
         if (rank > bestRank) {
            bestRank = rank;
            winner = plays[i];
         }
      }
   }
   let hearts = 0;
   for (const p of plays) {
      if (cardSuit(p.card) === "h") hearts += 1;
      else if (p.card.toLowerCase() === "qs") hearts += 13;
   }
   return { winner: winner.player_index, hearts };
}

/* ── Types ────────────────────────────────────────────────────────────── */

export type QueueItem =
   | { type: "play"; event: PlayEvent }
   | { type: "trick_complete" };

export interface TrickResult {
   winner: number;
   hearts: number;
   /** Monotonically increasing id so React can re-key animations. */
   id: number;
}

const EMPTY_SLOTS: CurrentTrickSlot[] = [null, null, null, null];

export interface UsePlayQueueOptions {
   onIdle: () => void;
}

/**
 * Queue-based trick animation hook.
 *
 * Drain model: "delay BEFORE show".
 *   play   -> wait 0.5s, show card, immediately process next
 *   trick_complete -> compute result, wait 1s (hold), sweep cards toward
 *                     winner over 0.45s, badge lingers 0.55s more, clear,
 *                     wait 0.3s, process next
 *
 * This means:
 *   - There is always a 1s gap after the human's instant card (the delay
 *     before the first queued AI card).
 *   - When the queue empties, onIdle fires immediately — no trailing 1s —
 *     so the human's legal moves appear the instant the last AI card is shown.
 *
 * Trick result tracking:
 *   - Every play (queued or immediate) is recorded in trickPlaysRef.
 *   - On trick_complete, the winner and heart count are computed client-side.
 *   - collectTarget + trickResult are set when the sweep animation starts;
 *     both are cleared when the board clears after the sweep.
 */
export function usePlayQueue({ onIdle }: UsePlayQueueOptions) {
   const [displaySlots, setDisplaySlots] =
      useState<CurrentTrickSlot[]>(EMPTY_SLOTS);
   const [busy, setBusy] = useState(false);
   /** Player index of whoever is "active" during animation (for turn indicator). */
   const [currentTurn, setCurrentTurn] = useState<number | null>(null);
   /** Result of the most recently completed trick (set when collect animation starts). */
   const [trickResult, setTrickResult] = useState<TrickResult | null>(null);
   /** Player index cards are sweeping toward (null = no animation). */
   const [collectTarget, setCollectTarget] = useState<number | null>(null);

   const queueRef = useRef<QueueItem[]>([]);
   const processingRef = useRef(false);
   const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const onIdleRef = useRef(onIdle);
   onIdleRef.current = onIdle;

   /** Cards played in the current trick (in chronological order). */
   const trickPlaysRef = useRef<PlayEvent[]>([]);
   const trickCounterRef = useRef(0);

   const processNext = useCallback(() => {
      const queue = queueRef.current;
      if (queue.length === 0) {
         processingRef.current = false;
         setBusy(false);
         setCurrentTurn(null);
         onIdleRef.current();
         return;
      }

      const item = queue[0]; // peek — don't shift until the delay fires

      if (item.type === "play") {
         setCurrentTurn(item.event.player_index);

         timerRef.current = setTimeout(() => {
            queue.shift();
            trickPlaysRef.current.push(item.event);
            setDisplaySlots((prev) => {
               const next = [...prev];
               const idx = item.event.player_index;
               if (idx >= 0 && idx < 4) {
                  next[idx] = {
                     player_index: idx,
                     card: item.event.card,
                  };
               }
               return next;
            });
            processNext();
         }, CARD_DELAY_MS);
      } else if (item.type === "trick_complete") {
         queue.shift();

         const result = computeTrickResult(trickPlaysRef.current);
         trickPlaysRef.current = [];

         // Hold so user can see all 4 cards, then sweep toward winner
         timerRef.current = setTimeout(() => {
            if (result) {
               setCollectTarget(result.winner);
               if (result.hearts > 0) {
                  setTrickResult({
                     ...result,
                     id: ++trickCounterRef.current,
                  });
               }
            }

            // After the sweep, clear the board but let the badge linger
            timerRef.current = setTimeout(() => {
               setCollectTarget(null);
               setDisplaySlots(EMPTY_SLOTS);
               setCurrentTurn(null);

               const linger = result && result.hearts > 0 ? BADGE_LINGER_MS : 0;
               timerRef.current = setTimeout(() => {
                  setTrickResult(null);
                  timerRef.current = setTimeout(processNext, CLEAR_MS);
               }, linger);
            }, COLLECT_MS);
         }, HOLD_MS);
      }
   }, []);

   const startDrain = useCallback(() => {
      if (processingRef.current) return;
      if (queueRef.current.length === 0) return;
      processingRef.current = true;
      setBusy(true);
      processNext();
   }, [processNext]);

   const enqueue = useCallback(
      (item: QueueItem) => {
         queueRef.current.push(item);
         startDrain();
      },
      [startDrain]
   );

   /** Show a card on the table immediately (for human plays). */
   const showImmediately = useCallback((event: PlayEvent) => {
      trickPlaysRef.current.push(event);
      setDisplaySlots((prev) => {
         const next = [...prev];
         const idx = event.player_index;
         if (idx >= 0 && idx < 4) {
            next[idx] = { player_index: idx, card: event.card };
         }
         return next;
      });
      setCurrentTurn(event.player_index);
   }, []);

   /** Directly set the display slots (e.g. to restore board state on page load). */
   const setSlots = useCallback((slots: CurrentTrickSlot[]) => {
      setDisplaySlots(slots);
   }, []);

   /** Cancel all pending timers, clear the queue and the board. */
   const reset = useCallback(() => {
      if (timerRef.current) {
         clearTimeout(timerRef.current);
         timerRef.current = null;
      }
      queueRef.current = [];
      processingRef.current = false;
      trickPlaysRef.current = [];
      setBusy(false);
      setCurrentTurn(null);
      setTrickResult(null);
      setCollectTarget(null);
      setDisplaySlots(EMPTY_SLOTS);
   }, []);

   return {
      displaySlots,
      busy,
      currentTurn,
      trickResult,
      collectTarget,
      enqueue,
      showImmediately,
      setSlots,
      reset,
   };
}
