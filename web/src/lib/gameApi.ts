/**
 * Client for game API: start, get state, submit pass, submit play.
 */

import { getApiUrl } from "@/lib/api";
import type {
   GameState,
   PlayResponse,
   StartGameBody,
   StartGameResponse,
   SubmitPassBody,
   SubmitPlayBody,
} from "@/types/game";

const base = () => getApiUrl();

async function parseJson<T>(res: Response): Promise<T> {
   const data = await res.json().catch(() => ({}));
   return data as T;
}

export type GameApiError = { error: string };

/** POST /games/start – create a new game. Pass token to tie game to user account. */
export async function startGame(
   body: StartGameBody = {},
   token?: string | null
): Promise<
   { ok: true; data: StartGameResponse } | { ok: false; error: string }
> {
   const headers: Record<string, string> = {
      "Content-Type": "application/json",
   };
   if (token) headers["Authorization"] = `Bearer ${token}`;
   const res = await fetch(`${base()}/games/start`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
   });
   const data = await parseJson<StartGameResponse & GameApiError>(res);
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: data as StartGameResponse };
}

/** GET /games/:id – fetch current game state */
export async function getGameState(
   gameId: string
): Promise<
   | { ok: true; data: GameState }
   | { ok: false; error: string; notFound?: boolean }
> {
   const res = await fetch(`${base()}/games/${encodeURIComponent(gameId)}`);
   const data = await parseJson<GameState & GameApiError>(res);
   if (res.status === 404) {
      return {
         ok: false,
         error: (data as GameApiError).error ?? "Game not found",
         notFound: true,
      };
   }
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: data as GameState };
}

/** POST /games/:id/pass – submit human's 3 cards to pass */
export async function submitPass(
   gameId: string,
   body: SubmitPassBody
): Promise<
   | { ok: true; data: GameState }
   | { ok: false; error: string; notFound?: boolean }
> {
   const res = await fetch(
      `${base()}/games/${encodeURIComponent(gameId)}/pass`,
      {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(body),
      }
   );
   const data = await parseJson<GameState & GameApiError>(res);
   if (res.status === 404) {
      return {
         ok: false,
         error: (data as GameApiError).error ?? "Game not found",
         notFound: true,
      };
   }
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: data as GameState };
}

/** POST /games/:id/advance – run AI until human's turn (e.g. when AI has 2♣ after pass). */
export async function advanceGame(
   gameId: string
): Promise<
   | { ok: true; data: PlayResponse }
   | { ok: false; error: string; notFound?: boolean }
> {
   const res = await fetch(
      `${base()}/games/${encodeURIComponent(gameId)}/advance`,
      { method: "POST" }
   );
   const data = await parseJson<PlayResponse & GameApiError>(res);
   if (res.status === 404) {
      return {
         ok: false,
         error: (data as GameApiError).error ?? "Game not found",
         notFound: true,
      };
   }
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: data as PlayResponse };
}

/** POST /games/:id/play – play one card. Returns state + intermediate_plays, round_just_ended for animation. */
export async function submitPlay(
   gameId: string,
   body: SubmitPlayBody
): Promise<
   | { ok: true; data: PlayResponse }
   | { ok: false; error: string; notFound?: boolean }
> {
   const res = await fetch(
      `${base()}/games/${encodeURIComponent(gameId)}/play`,
      {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(body),
      }
   );
   const data = await parseJson<PlayResponse & GameApiError>(res);
   if (res.status === 404) {
      return {
         ok: false,
         error: (data as GameApiError).error ?? "Game not found",
         notFound: true,
      };
   }
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: data as PlayResponse };
}

/** POST /games/:id/concede – concede and delete the game */
export async function concedeGame(
   gameId: string,
   token?: string | null
): Promise<
   { ok: true; newly_unlocked: string[] } | { ok: false; error: string }
> {
   const headers: Record<string, string> = {};
   if (token) headers["Authorization"] = `Bearer ${token}`;
   const res = await fetch(
      `${base()}/games/${encodeURIComponent(gameId)}/concede`,
      { method: "POST", headers }
   );
   if (!res.ok) {
      const data = await parseJson<GameApiError>(res);
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   const data = await parseJson<{ newly_unlocked?: string[] }>(res);
   return { ok: true, newly_unlocked: data.newly_unlocked ?? [] };
}

/** GET /games/active – check if the authenticated user has an active game */
export async function checkActiveGame(
   token: string
): Promise<
   { ok: true; game_id: string | null } | { ok: false; error: string }
> {
   const res = await fetch(`${base()}/games/active`, {
      headers: { Authorization: `Bearer ${token}` },
   });
   const data = await parseJson<{ game_id: string | null } & GameApiError>(res);
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, game_id: (data as { game_id: string | null }).game_id };
}

// ── Stats ──────────────────────────────────────────────────────────────

export type UserStatsResponse = {
   games_played: number;
   games_won: number;
   moon_shots: number;
   best_score: number | null;
   worst_score: number | null;
   average_score: number | null;
   hard_wins: number;
   harder_wins: number;
   hardest_wins: number;
   current_win_streak: number;
   max_win_streak: number;
   night_owl: boolean;
   lucky_seven: boolean;
   double_moon: boolean;
   geezer: boolean;
   wimp: boolean;
   early_bird: boolean;
   lonely_heart: boolean;
   photo_finish: boolean;
   demolition: boolean;
   speed_demon: boolean;
   marathon: boolean;
   eclipse: boolean;
   heartbreaker: boolean;
   monthly_star: boolean;
   hall_of_fame: boolean;
   new_year: boolean;
   lucky_clover: boolean;
   easter_egg: boolean;
   fireworks: boolean;
   spooky: boolean;
   thankful: boolean;
   christmas_spirit: boolean;
};

export async function fetchStats(
   token: string
): Promise<
   { ok: true; data: UserStatsResponse } | { ok: false; error: string }
> {
   const res = await fetch(`${base()}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
   });
   const data = await parseJson<{ stats: UserStatsResponse } & GameApiError>(
      res
   );
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: (data as { stats: UserStatsResponse }).stats };
}

// ── Per-difficulty stats ────────────────────────────────────────────

export type CategoryStats = {
   games_played: number;
   games_won: number;
   moon_shots: number;
   best_score: number | null;
   worst_score: number | null;
   average_score: number | null;
   current_win_streak: number;
   max_win_streak: number;
};

export type DifficultyStatsMap = {
   easy: CategoryStats | null;
   medium: CategoryStats | null;
   my_mom: CategoryStats | null;
   multiplayer: CategoryStats | null;
};

export async function fetchDifficultyStats(
   token: string
): Promise<
   { ok: true; data: DifficultyStatsMap } | { ok: false; error: string }
> {
   const res = await fetch(`${base()}/stats/by-category`, {
      headers: { Authorization: `Bearer ${token}` },
   });
   const data = await parseJson<DifficultyStatsMap & GameApiError>(res);
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: data as DifficultyStatsMap };
}

export type RecordGameStatsResponse = {
   stats: UserStatsResponse;
   newly_unlocked: string[];
};

export async function recordGameStats(
   token: string,
   body: {
      game_id: string;
      final_score: number;
      won: boolean;
      moon_shots: number;
      round_count: number;
      all_scores: number[];
      hearts_broken_count: number;
      difficulty?: string;
   }
): Promise<
   { ok: true; data: RecordGameStatsResponse } | { ok: false; error: string }
> {
   const res = await fetch(`${base()}/stats/record`, {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
   });
   const data = await parseJson<RecordGameStatsResponse & GameApiError>(res);
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: data as RecordGameStatsResponse };
}

/** POST /stats/unlock – unlock a UI-triggered achievement */
export async function unlockAchievement(
   token: string,
   achievement: string
): Promise<
   { ok: true; newly_unlocked: string[] } | { ok: false; error: string }
> {
   const res = await fetch(`${base()}/stats/unlock`, {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ achievement }),
   });
   const data = await parseJson<{ newly_unlocked: string[] } & GameApiError>(
      res
   );
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return {
      ok: true,
      newly_unlocked: (data as { newly_unlocked: string[] }).newly_unlocked,
   };
}

// ── Leaderboard ────────────────────────────────────────────────────────

export type LeaderboardEntry = {
   rank: number;
   username: string;
   profile_icon: string;
   games_won: number;
};

export type LeaderboardResponse = {
   monthly: LeaderboardEntry[];
   all_time: LeaderboardEntry[];
};

export async function fetchLeaderboard(
   category: string
): Promise<
   { ok: true; data: LeaderboardResponse } | { ok: false; error: string }
> {
   const res = await fetch(
      `${base()}/leaderboard?category=${encodeURIComponent(category)}`
   );
   const data = await parseJson<LeaderboardResponse & GameApiError>(res);
   if (!res.ok) {
      return {
         ok: false,
         error:
            (data as GameApiError).error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: data as LeaderboardResponse };
}
