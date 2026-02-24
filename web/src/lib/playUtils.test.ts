import {
   reorderSlotsForTableLayout,
   getShortName,
   detectShootTheMoon,
   computeRoundDeltas,
} from "./playUtils";

describe("reorderSlotsForTableLayout", () => {
   it("reorders with default mySeat=0", () => {
      // Input: [bottom, left, top, right] in game order
      // Output: [bottom(0), top(2), left(1), right(3)]
      const result = reorderSlotsForTableLayout(["A", "B", "C", "D"]);
      expect(result).toEqual(["A", "C", "B", "D"]);
   });

   it("rotates and reorders with mySeat=1", () => {
      const result = reorderSlotsForTableLayout(["A", "B", "C", "D"], 1);
      // Rotated: [B, C, D, A], then swap [1] and [2] -> [B, D, C, A]
      expect(result).toEqual(["B", "D", "C", "A"]);
   });

   it("rotates and reorders with mySeat=2", () => {
      const result = reorderSlotsForTableLayout(["A", "B", "C", "D"], 2);
      // Rotated: [C, D, A, B], then swap [1] and [2] -> [C, A, D, B]
      expect(result).toEqual(["C", "A", "D", "B"]);
   });

   it("rotates and reorders with mySeat=3", () => {
      const result = reorderSlotsForTableLayout(["A", "B", "C", "D"], 3);
      // Rotated: [D, A, B, C], then swap [1] and [2] -> [D, B, A, C]
      expect(result).toEqual(["D", "B", "A", "C"]);
   });

   it("returns array unchanged if length < 4", () => {
      expect(reorderSlotsForTableLayout(["A", "B"])).toEqual(["A", "B"]);
   });
});

describe("getShortName", () => {
   it("shortens Bot names", () => {
      expect(getShortName("Bot 1")).toBe("B1");
      expect(getShortName("Bot 3")).toBe("B3");
   });

   it("shortens Guest names", () => {
      expect(getShortName("Guest 2")).toBe("G2");
   });

   it("shortens You", () => {
      expect(getShortName("You")).toBe("Y");
   });

   it("takes first char uppercase for other names", () => {
      expect(getShortName("shmemcat")).toBe("S");
      expect(getShortName("alice")).toBe("A");
   });

   it("trims whitespace", () => {
      expect(getShortName("  Bot 1  ")).toBe("B1");
   });
});

describe("detectShootTheMoon", () => {
   it("detects moon shot (one 0, three 26s)", () => {
      expect(detectShootTheMoon([0, 26, 26, 26])).toBe(0);
      expect(detectShootTheMoon([26, 0, 26, 26])).toBe(1);
      expect(detectShootTheMoon([26, 26, 26, 0])).toBe(3);
   });

   it("returns -1 when no moon shot", () => {
      expect(detectShootTheMoon([5, 10, 8, 3])).toBe(-1);
      expect(detectShootTheMoon([0, 0, 26, 0])).toBe(-1);
   });
});

describe("computeRoundDeltas", () => {
   it("computes correct deltas", () => {
      const prev = [10, 20, 30, 40];
      const current = [
         { score: 15 },
         { score: 22 },
         { score: 35 },
         { score: 54 },
      ];
      expect(computeRoundDeltas(prev, current)).toEqual([5, 2, 5, 14]);
   });

   it("handles zero previous scores", () => {
      const prev = [0, 0, 0, 0];
      const current = [{ score: 5 }, { score: 10 }, { score: 8 }, { score: 3 }];
      expect(computeRoundDeltas(prev, current)).toEqual([5, 10, 8, 3]);
   });
});
