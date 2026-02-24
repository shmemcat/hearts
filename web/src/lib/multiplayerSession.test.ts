import { vi, beforeEach } from "vitest";
import {
   findActiveMultiplayerSession,
   clearMultiplayerSession,
} from "./multiplayerSession";

beforeEach(() => {
   localStorage.clear();
});

describe("findActiveMultiplayerSession", () => {
   it("returns game session when mp token exists", () => {
      localStorage.setItem("hearts_mp_token_abc123", "tok");
      const result = findActiveMultiplayerSession();
      expect(result).toEqual({ type: "game", gameId: "abc123" });
   });

   it("returns lobby session when lobby token exists", () => {
      localStorage.setItem("hearts_lobby_token_XYZW12", "tok");
      const result = findActiveMultiplayerSession();
      expect(result).toEqual({ type: "lobby", code: "XYZW12" });
   });

   it("returns null when no tokens", () => {
      localStorage.setItem("unrelated_key", "value");
      const result = findActiveMultiplayerSession();
      expect(result).toBeNull();
   });

   it("prioritizes game over lobby", () => {
      localStorage.setItem("hearts_mp_token_game1", "tok");
      localStorage.setItem("hearts_lobby_token_LOBBY1", "tok");
      const result = findActiveMultiplayerSession();
      expect(result).not.toBeNull();
      // localStorage iteration order is insertion order; game was first
      expect(result!.type).toBe("game");
   });
});

describe("clearMultiplayerSession", () => {
   it("removes game tokens", () => {
      localStorage.setItem("hearts_mp_token_g1", "tok");
      localStorage.setItem("hearts_mp_seat_g1", "2");
      clearMultiplayerSession({ type: "game", gameId: "g1" });
      expect(localStorage.getItem("hearts_mp_token_g1")).toBeNull();
      expect(localStorage.getItem("hearts_mp_seat_g1")).toBeNull();
   });

   it("removes lobby token", () => {
      localStorage.setItem("hearts_lobby_token_ABC123", "tok");
      clearMultiplayerSession({ type: "lobby", code: "ABC123" });
      expect(localStorage.getItem("hearts_lobby_token_ABC123")).toBeNull();
   });
});
