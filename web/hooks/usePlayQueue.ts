import { useCallback, useRef, useState } from "react";
import type { CurrentTrickSlot, PlayEvent } from "@/types/game";

/** Delay before each card reveal; also the hold duration after a completed trick. */
const STEP_MS = 1000;
/** Duration of the empty-board flash between tricks. */
const CLEAR_MS = 500;

export type QueueItem =
   | { type: "play"; event: PlayEvent }
   | { type: "trick_complete" };

const EMPTY_SLOTS: CurrentTrickSlot[] = [null, null, null, null];

export interface UsePlayQueueOptions {
   onIdle: () => void;
}

/**
 * Queue-based trick animation hook.
 *
 * Drain model: "delay BEFORE show".
 *   play   -> wait 1s, show card, immediately process next
 *   trick_complete -> wait 1s (hold), clear board, wait 0.5s, process next
 *
 * This means:
 *   - There is always a 1s gap after the human's instant card (the delay
 *     before the first queued AI card).
 *   - When the queue empties, onIdle fires immediately — no trailing 1s —
 *     so the human's legal moves appear the instant the last AI card is shown.
 */
export function usePlayQueue({ onIdle }: UsePlayQueueOptions) {
   const [displaySlots, setDisplaySlots] =
      useState<CurrentTrickSlot[]>(EMPTY_SLOTS);
   const [busy, setBusy] = useState(false);
   /** Player index of whoever is "active" during animation (for turn indicator). */
   const [currentTurn, setCurrentTurn] = useState<number | null>(null);

   const queueRef = useRef<QueueItem[]>([]);
   const processingRef = useRef(false);
   const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const onIdleRef = useRef(onIdle);
   onIdleRef.current = onIdle;

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
         // Highlight this player's seat during the 1s lead-in
         setCurrentTurn(item.event.player_index);

         timerRef.current = setTimeout(() => {
            queue.shift();
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
            processNext(); // immediately check for next item
         }, STEP_MS);
      } else if (item.type === "trick_complete") {
         queue.shift();
         // Hold 1s so user can see all 4 cards, then clear, then 0.5s empty
         timerRef.current = setTimeout(() => {
            setDisplaySlots(EMPTY_SLOTS);
            setCurrentTurn(null);
            timerRef.current = setTimeout(processNext, CLEAR_MS);
         }, STEP_MS);
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
      setBusy(false);
      setCurrentTurn(null);
      setDisplaySlots(EMPTY_SLOTS);
   }, []);

   return {
      displaySlots,
      busy,
      currentTurn,
      enqueue,
      showImmediately,
      setSlots,
      reset,
   };
}
