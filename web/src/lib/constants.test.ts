import {
   SUIT_SYMBOL,
   SUIT_RED,
   RANK_ORDER,
   emptySlots,
   USERNAME_RE,
   MIN_PASSWORD_LEN,
   EMPTY_SLOTS,
} from "./constants";

describe("SUIT_SYMBOL", () => {
   it("maps all four suits to their symbols", () => {
      expect(SUIT_SYMBOL).toEqual({
         c: "♣",
         d: "♦",
         s: "♠",
         h: "♥",
      });
   });

   it("has exactly 4 entries", () => {
      expect(Object.keys(SUIT_SYMBOL)).toHaveLength(4);
   });
});

describe("SUIT_RED", () => {
   it("contains diamonds and hearts", () => {
      expect(SUIT_RED.has("d")).toBe(true);
      expect(SUIT_RED.has("h")).toBe(true);
   });

   it("does not contain clubs or spades", () => {
      expect(SUIT_RED.has("c")).toBe(false);
      expect(SUIT_RED.has("s")).toBe(false);
   });

   it("has exactly 2 entries", () => {
      expect(SUIT_RED.size).toBe(2);
   });
});

describe("RANK_ORDER", () => {
   it("maps all 13 ranks to correct numeric values", () => {
      expect(RANK_ORDER["2"]).toBe(2);
      expect(RANK_ORDER["3"]).toBe(3);
      expect(RANK_ORDER["4"]).toBe(4);
      expect(RANK_ORDER["5"]).toBe(5);
      expect(RANK_ORDER["6"]).toBe(6);
      expect(RANK_ORDER["7"]).toBe(7);
      expect(RANK_ORDER["8"]).toBe(8);
      expect(RANK_ORDER["9"]).toBe(9);
      expect(RANK_ORDER["10"]).toBe(10);
      expect(RANK_ORDER["J"]).toBe(11);
      expect(RANK_ORDER["Q"]).toBe(12);
      expect(RANK_ORDER["K"]).toBe(13);
      expect(RANK_ORDER["A"]).toBe(14);
   });

   it("has exactly 13 entries", () => {
      expect(Object.keys(RANK_ORDER)).toHaveLength(13);
   });

   it("Ace is the highest rank", () => {
      const maxRank = Math.max(...Object.values(RANK_ORDER));
      expect(RANK_ORDER["A"]).toBe(maxRank);
   });
});

describe("emptySlots", () => {
   it("returns an array of 4 nulls", () => {
      expect(emptySlots()).toEqual([null, null, null, null]);
   });

   it("returns a new array each call (not referentially equal)", () => {
      const a = emptySlots();
      const b = emptySlots();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
   });
});

describe("EMPTY_SLOTS", () => {
   it("is a frozen array of 4 nulls", () => {
      expect(EMPTY_SLOTS).toEqual([null, null, null, null]);
      expect(Object.isFrozen(EMPTY_SLOTS)).toBe(true);
   });
});

describe("USERNAME_RE", () => {
   it("accepts valid usernames", () => {
      expect(USERNAME_RE.test("abc")).toBe(true);
      expect(USERNAME_RE.test("user_123")).toBe(true);
      expect(USERNAME_RE.test("A")).toBe(false); // too short
      expect(USERNAME_RE.test("ab")).toBe(false); // too short
      expect(USERNAME_RE.test("abc")).toBe(true); // min length 3
      expect(USERNAME_RE.test("a".repeat(64))).toBe(true); // max length 64
   });

   it("rejects names that are too long", () => {
      expect(USERNAME_RE.test("a".repeat(65))).toBe(false);
   });

   it("rejects special characters", () => {
      expect(USERNAME_RE.test("user name")).toBe(false);
      expect(USERNAME_RE.test("user@name")).toBe(false);
      expect(USERNAME_RE.test("user.name")).toBe(false);
      expect(USERNAME_RE.test("user-name")).toBe(false);
   });

   it("allows underscores", () => {
      expect(USERNAME_RE.test("user_name")).toBe(true);
      expect(USERNAME_RE.test("___")).toBe(true);
   });
});

describe("MIN_PASSWORD_LEN", () => {
   it("is 8", () => {
      expect(MIN_PASSWORD_LEN).toBe(8);
   });
});
