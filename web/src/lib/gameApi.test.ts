import { vi, beforeEach, afterEach } from "vitest";
import {
   startGame,
   getGameState,
   submitPass,
   submitPlay,
   advanceGame,
   concedeGame,
   checkActiveGame,
   fetchStats,
   recordGameStats,
} from "./gameApi";

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

function failJsonResponse(body: unknown, status = 400) {
   return jsonResponse(body, status);
}

// ── startGame ────────────────────────────────────────────────────────

describe("startGame", () => {
   it("returns ok with game_id on success", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ game_id: "abc123" }));
      const result = await startGame({ player_name: "You" });
      expect(result).toEqual({ ok: true, data: { game_id: "abc123" } });
   });

   it("sends auth header when token provided", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ game_id: "abc" }));
      await startGame({}, "my-token");
      expect(mockFetch).toHaveBeenCalledWith(
         expect.any(String),
         expect.objectContaining({
            headers: expect.objectContaining({
               Authorization: "Bearer my-token",
            }),
         })
      );
   });

   it("does not send auth header when no token", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ game_id: "abc" }));
      await startGame({});
      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders.Authorization).toBeUndefined();
   });

   it("returns error on failure", async () => {
      mockFetch.mockReturnValueOnce(
         failJsonResponse({ error: "Bad request" }, 400)
      );
      const result = await startGame({});
      expect(result).toEqual({ ok: false, error: "Bad request" });
   });

   it("returns generic error when no error message", async () => {
      mockFetch.mockReturnValueOnce(failJsonResponse({}, 500));
      const result = await startGame({});
      expect(result).toEqual({ ok: false, error: "Request failed (500)" });
   });
});

// ── getGameState ─────────────────────────────────────────────────────

describe("getGameState", () => {
   it("returns game state on success", async () => {
      const state = { phase: "playing", round: 1 };
      mockFetch.mockReturnValueOnce(jsonResponse(state));
      const result = await getGameState("game1");
      expect(result).toEqual({ ok: true, data: state });
   });

   it("returns notFound on 404", async () => {
      mockFetch.mockReturnValueOnce(
         failJsonResponse({ error: "Game not found" }, 404)
      );
      const result = await getGameState("missing");
      expect(result).toEqual({
         ok: false,
         error: "Game not found",
         notFound: true,
      });
   });

   it("returns error on other failures", async () => {
      mockFetch.mockReturnValueOnce(failJsonResponse({ error: "Fail" }, 500));
      const result = await getGameState("game1");
      expect(result).toEqual({ ok: false, error: "Fail" });
   });

   it("encodes game ID in URL", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}));
      await getGameState("game with spaces");
      expect(mockFetch).toHaveBeenCalledWith(
         expect.stringContaining("game%20with%20spaces")
      );
   });
});

// ── submitPass ────────────────────────────────────────────────────────

describe("submitPass", () => {
   it("returns game state on success", async () => {
      const state = { phase: "playing" };
      mockFetch.mockReturnValueOnce(jsonResponse(state));
      const result = await submitPass("g1", { cards: ["2c", "3d", "4s"] });
      expect(result).toEqual({ ok: true, data: state });
   });

   it("sends POST with cards body", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}));
      await submitPass("g1", { cards: ["2c", "3d", "4s"] });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body)).toEqual({ cards: ["2c", "3d", "4s"] });
   });

   it("returns notFound on 404", async () => {
      mockFetch.mockReturnValueOnce(failJsonResponse({}, 404));
      const result = await submitPass("g1", { cards: ["2c", "3d", "4s"] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.notFound).toBe(true);
   });
});

// ── submitPlay ────────────────────────────────────────────────────────

describe("submitPlay", () => {
   it("returns play response on success", async () => {
      const resp = { phase: "playing", intermediate_plays: [] };
      mockFetch.mockReturnValueOnce(jsonResponse(resp));
      const result = await submitPlay("g1", { card: "Ah" });
      expect(result).toEqual({ ok: true, data: resp });
   });

   it("returns notFound on 404", async () => {
      mockFetch.mockReturnValueOnce(failJsonResponse({}, 404));
      const result = await submitPlay("g1", { card: "Ah" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.notFound).toBe(true);
   });
});

// ── advanceGame ──────────────────────────────────────────────────────

describe("advanceGame", () => {
   it("returns play response on success", async () => {
      const resp = { phase: "playing" };
      mockFetch.mockReturnValueOnce(jsonResponse(resp));
      const result = await advanceGame("g1");
      expect(result).toEqual({ ok: true, data: resp });
   });

   it("sends POST without body", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}));
      await advanceGame("g1");
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe("POST");
   });
});

// ── concedeGame ──────────────────────────────────────────────────────

describe("concedeGame", () => {
   it("returns ok on success", async () => {
      mockFetch.mockReturnValueOnce(
         jsonResponse(null, 200).then((r) => ({ ...r, ok: true }))
      );
      const result = await concedeGame("g1");
      expect(result).toEqual({ ok: true });
   });

   it("sends auth header when token provided", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse(null));
      await concedeGame("g1", "tok");
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(
         "Bearer tok"
      );
   });

   it("returns error on failure", async () => {
      mockFetch.mockReturnValueOnce(
         failJsonResponse({ error: "Not your game" }, 403)
      );
      const result = await concedeGame("g1");
      expect(result).toEqual({ ok: false, error: "Not your game" });
   });
});

// ── checkActiveGame ──────────────────────────────────────────────────

describe("checkActiveGame", () => {
   it("returns game_id when active game exists", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ game_id: "active1" }));
      const result = await checkActiveGame("tok");
      expect(result).toEqual({ ok: true, game_id: "active1" });
   });

   it("returns null game_id when no active game", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ game_id: null }));
      const result = await checkActiveGame("tok");
      expect(result).toEqual({ ok: true, game_id: null });
   });

   it("sends auth header", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ game_id: null }));
      await checkActiveGame("my-tok");
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(
         "Bearer my-tok"
      );
   });
});

// ── fetchStats ───────────────────────────────────────────────────────

describe("fetchStats", () => {
   it("returns stats on success", async () => {
      const stats = { games_played: 10, games_won: 3 };
      mockFetch.mockReturnValueOnce(jsonResponse({ stats }));
      const result = await fetchStats("tok");
      expect(result).toEqual({ ok: true, data: stats });
   });

   it("returns error on failure", async () => {
      mockFetch.mockReturnValueOnce(failJsonResponse({ error: "Unauthorized" }, 401));
      const result = await fetchStats("tok");
      expect(result).toEqual({ ok: false, error: "Unauthorized" });
   });
});

// ── recordGameStats ──────────────────────────────────────────────────

describe("recordGameStats", () => {
   it("returns updated stats on success", async () => {
      const stats = { games_played: 11, games_won: 4 };
      mockFetch.mockReturnValueOnce(jsonResponse({ stats }));
      const result = await recordGameStats("tok", {
         game_id: "g1",
         final_score: 42,
         won: true,
         moon_shots: 1,
      });
      expect(result).toEqual({ ok: true, data: stats });
   });

   it("sends POST with auth and body", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ stats: {} }));
      await recordGameStats("tok", {
         game_id: "g1",
         final_score: 42,
         won: true,
         moon_shots: 0,
      });
      const [, opts] = mockFetch.mock.calls[0];
      expect(opts.method).toBe("POST");
      expect(opts.headers.Authorization).toBe("Bearer tok");
      expect(JSON.parse(opts.body)).toEqual({
         game_id: "g1",
         final_score: 42,
         won: true,
         moon_shots: 0,
      });
   });
});
