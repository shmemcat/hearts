import { vi, beforeEach, afterEach } from "vitest";
import {
   createLobby,
   getLobbyState,
   checkMultiplayerGameActive,
   concedeMultiplayerGame,
} from "./lobbyApi";

const mockFetch = vi.fn();

beforeEach(() => {
   mockFetch.mockReset();
   vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
   vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
   return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
   } as Response);
}

describe("createLobby", () => {
   it("sends correct request and returns success", async () => {
      const data = {
         code: "ABC123",
         url: "http://localhost/game/lobby/ABC123",
         player_token: "tok",
      };
      mockFetch.mockReturnValueOnce(jsonResponse(data, 201));
      const result = await createLobby("Alice");
      expect(result).toEqual({ ok: true, data });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/lobbies/create");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body)).toEqual({ host_name: "Alice" });
   });

   it("returns error on non-ok response", async () => {
      mockFetch.mockReturnValueOnce(
         jsonResponse({ error: "Rate limited" }, 429)
      );
      const result = await createLobby("Bob");
      expect(result).toEqual({ ok: false, error: "Rate limited" });
   });

   it("returns generic error when no error message", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}, 500));
      const result = await createLobby("Bob");
      expect(result).toEqual({ ok: false, error: "Request failed (500)" });
   });
});

describe("getLobbyState", () => {
   it("sends GET and returns parsed lobby", async () => {
      const lobby = { code: "XYZ", seats: [], status: "waiting" };
      mockFetch.mockReturnValueOnce(jsonResponse(lobby));
      const result = await getLobbyState("XYZ");
      expect(result).toEqual({ ok: true, data: lobby });
      expect(mockFetch.mock.calls[0][0]).toContain("/lobbies/XYZ");
   });

   it("returns error on 404", async () => {
      mockFetch.mockReturnValueOnce(
         jsonResponse({ error: "Lobby not found" }, 404)
      );
      const result = await getLobbyState("NOPE");
      expect(result).toEqual({ ok: false, error: "Lobby not found" });
   });
});

describe("checkMultiplayerGameActive", () => {
   it("returns true when active", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ active: true }));
      const result = await checkMultiplayerGameActive("game1");
      expect(result).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toContain(
         "/lobbies/game/game1/active"
      );
   });

   it("returns false when inactive", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ active: false }));
      const result = await checkMultiplayerGameActive("game2");
      expect(result).toBe(false);
   });

   it("returns false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const result = await checkMultiplayerGameActive("game3");
      expect(result).toBe(false);
   });
});

describe("concedeMultiplayerGame", () => {
   it("sends POST with player_token and returns status", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ status: "conceded" }));
      const result = await concedeMultiplayerGame("game1", "tok123");
      expect(result).toEqual({ ok: true, status: "conceded" });
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/lobbies/game/game1/concede");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body)).toEqual({ player_token: "tok123" });
   });

   it("returns terminated status", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ status: "terminated" }));
      const result = await concedeMultiplayerGame("game2", "tok456");
      expect(result).toEqual({ ok: true, status: "terminated" });
   });

   it("returns error on 404", async () => {
      mockFetch.mockReturnValueOnce(
         jsonResponse({ error: "Game not found or seat not valid" }, 404)
      );
      const result = await concedeMultiplayerGame("gone", "tok");
      expect(result).toEqual({
         ok: false,
         error: "Game not found or seat not valid",
      });
   });

   it("returns error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const result = await concedeMultiplayerGame("game3", "tok");
      expect(result).toEqual({ ok: false, error: "Network error" });
   });
});
