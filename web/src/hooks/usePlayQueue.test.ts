import { renderHook, act } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { usePlayQueue, type QueueItem } from "./usePlayQueue";
import { CARD_DELAY_MS, HOLD_MS, COLLECT_MS, BADGE_LINGER_MS, CLEAR_MS } from "@/lib/constants";

beforeEach(() => {
   vi.useFakeTimers();
});

afterEach(() => {
   vi.useRealTimers();
});

function setup() {
   const onIdle = vi.fn();
   const result = renderHook(() => usePlayQueue({ onIdle }));
   return { ...result, onIdle };
}

describe("usePlayQueue", () => {
   it("initializes with empty display slots and not busy", () => {
      const { result } = setup();
      expect(result.current.displaySlots).toEqual([null, null, null, null]);
      expect(result.current.busy).toBe(false);
      expect(result.current.currentTurn).toBeNull();
      expect(result.current.trickResult).toBeNull();
      expect(result.current.collectTarget).toBeNull();
   });

   it("showImmediately places a card without delay", () => {
      const { result } = setup();
      act(() => {
         result.current.showImmediately({ player_index: 0, card: "2c" });
      });
      expect(result.current.displaySlots[0]).toEqual({
         player_index: 0,
         card: "2c",
      });
      expect(result.current.currentTurn).toBe(0);
   });

   it("enqueue + drain shows card after CARD_DELAY_MS", () => {
      const { result } = setup();
      act(() => {
         result.current.enqueue({
            type: "play",
            event: { player_index: 1, card: "5d" },
         });
      });

      expect(result.current.busy).toBe(true);
      expect(result.current.currentTurn).toBe(1);
      expect(result.current.displaySlots[1]).toBeNull();

      act(() => {
         vi.advanceTimersByTime(CARD_DELAY_MS);
      });

      expect(result.current.displaySlots[1]).toEqual({
         player_index: 1,
         card: "5d",
      });
   });

   it("calls onIdle when queue empties after a play", () => {
      const { result, onIdle } = setup();
      act(() => {
         result.current.enqueue({
            type: "play",
            event: { player_index: 2, card: "Ah" },
         });
      });

      act(() => {
         vi.advanceTimersByTime(CARD_DELAY_MS);
      });

      expect(onIdle).toHaveBeenCalledTimes(1);
      expect(result.current.busy).toBe(false);
   });

   it("processes trick_complete with hold, collect, and clear", () => {
      const { result } = setup();

      act(() => {
         result.current.showImmediately({ player_index: 0, card: "Ac" });
      });
      act(() => {
         result.current.enqueue({
            type: "play",
            event: { player_index: 1, card: "Kc" },
         });
      });
      act(() => { vi.advanceTimersByTime(CARD_DELAY_MS); });

      act(() => {
         result.current.enqueue({
            type: "play",
            event: { player_index: 2, card: "Qc" },
         });
      });
      act(() => { vi.advanceTimersByTime(CARD_DELAY_MS); });

      act(() => {
         result.current.enqueue({
            type: "play",
            event: { player_index: 3, card: "Jc" },
         });
      });
      act(() => { vi.advanceTimersByTime(CARD_DELAY_MS); });

      // All 4 cards on the table
      expect(result.current.displaySlots.filter(Boolean)).toHaveLength(4);

      // Enqueue trick_complete
      act(() => {
         result.current.enqueue({ type: "trick_complete" });
      });

      // After HOLD_MS, collect animation starts
      act(() => { vi.advanceTimersByTime(HOLD_MS); });
      // Ace of clubs leads clubs, Ace is highest → winner = player 0
      expect(result.current.collectTarget).toBe(0);

      // After COLLECT_MS, board clears
      act(() => { vi.advanceTimersByTime(COLLECT_MS); });
      expect(result.current.collectTarget).toBeNull();
      expect(result.current.displaySlots).toEqual([null, null, null, null]);
   });

   it("tracks hearts in trick result (Queen of Spades = 13)", () => {
      const { result } = setup();

      // Play 4 spades with Qs included, and one heart
      act(() => {
         result.current.showImmediately({ player_index: 0, card: "As" });
      });
      act(() => {
         result.current.enqueue({
            type: "play",
            event: { player_index: 1, card: "Qs" },
         });
      });
      act(() => { vi.advanceTimersByTime(CARD_DELAY_MS); });

      act(() => {
         result.current.enqueue({
            type: "play",
            event: { player_index: 2, card: "5h" },
         });
      });
      act(() => { vi.advanceTimersByTime(CARD_DELAY_MS); });

      act(() => {
         result.current.enqueue({
            type: "play",
            event: { player_index: 3, card: "3h" },
         });
      });
      act(() => { vi.advanceTimersByTime(CARD_DELAY_MS); });

      act(() => {
         result.current.enqueue({ type: "trick_complete" });
      });

      act(() => { vi.advanceTimersByTime(HOLD_MS); });

      // Qs = 13, 5h = 1, 3h = 1 → 15 hearts
      expect(result.current.trickResult).toMatchObject({
         winner: 0,
         hearts: 15,
      });
   });

   it("reset clears all state", () => {
      const { result } = setup();
      act(() => {
         result.current.showImmediately({ player_index: 0, card: "2c" });
      });
      expect(result.current.displaySlots[0]).not.toBeNull();

      act(() => {
         result.current.reset();
      });
      expect(result.current.displaySlots).toEqual([null, null, null, null]);
      expect(result.current.busy).toBe(false);
      expect(result.current.currentTurn).toBeNull();
      expect(result.current.trickResult).toBeNull();
      expect(result.current.collectTarget).toBeNull();
   });

   it("isActive returns false when idle", () => {
      const { result } = setup();
      expect(result.current.isActive()).toBe(false);
   });

   it("isActive returns true while processing", () => {
      const { result } = setup();
      act(() => {
         result.current.enqueue({
            type: "play",
            event: { player_index: 1, card: "3d" },
         });
      });
      expect(result.current.isActive()).toBe(true);

      act(() => { vi.advanceTimersByTime(CARD_DELAY_MS); });
      expect(result.current.isActive()).toBe(false);
   });

   it("setSlots directly updates display slots", () => {
      const { result } = setup();
      const slots = [
         { player_index: 0, card: "2c" },
         null,
         null,
         { player_index: 3, card: "Ah" },
      ];
      act(() => {
         result.current.setSlots(slots);
      });
      expect(result.current.displaySlots).toEqual(slots);
   });
});
