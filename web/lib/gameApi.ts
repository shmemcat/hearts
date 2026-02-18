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

/** POST /games/start – create a new game */
export async function startGame(
  body: StartGameBody = {}
): Promise<{ ok: true; data: StartGameResponse } | { ok: false; error: string }> {
  const res = await fetch(`${base()}/games/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<StartGameResponse & GameApiError>(res);
  if (!res.ok) {
    return { ok: false, error: (data as GameApiError).error ?? `Request failed (${res.status})` };
  }
  return { ok: true, data: data as StartGameResponse };
}

/** GET /games/:id – fetch current game state */
export async function getGameState(
  gameId: string
): Promise<{ ok: true; data: GameState } | { ok: false; error: string; notFound?: boolean }> {
  const res = await fetch(
    `${base()}/games/${encodeURIComponent(gameId)}`
  );
  const data = await parseJson<GameState & GameApiError>(res);
  if (res.status === 404) {
    return { ok: false, error: (data as GameApiError).error ?? "Game not found", notFound: true };
  }
  if (!res.ok) {
    return { ok: false, error: (data as GameApiError).error ?? `Request failed (${res.status})` };
  }
  return { ok: true, data: data as GameState };
}

/** POST /games/:id/pass – submit human's 3 cards to pass */
export async function submitPass(
  gameId: string,
  body: SubmitPassBody
): Promise<{ ok: true; data: GameState } | { ok: false; error: string; notFound?: boolean }> {
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
    return { ok: false, error: (data as GameApiError).error ?? "Game not found", notFound: true };
  }
  if (!res.ok) {
    return { ok: false, error: (data as GameApiError).error ?? `Request failed (${res.status})` };
  }
  return { ok: true, data: data as GameState };
}

/** POST /games/:id/advance – run AI until human's turn (e.g. when AI has 2♣ after pass). */
export async function advanceGame(
  gameId: string
): Promise<{ ok: true; data: PlayResponse } | { ok: false; error: string; notFound?: boolean }> {
  const res = await fetch(
    `${base()}/games/${encodeURIComponent(gameId)}/advance`,
    { method: "POST" }
  );
  const data = await parseJson<PlayResponse & GameApiError>(res);
  if (res.status === 404) {
    return { ok: false, error: (data as GameApiError).error ?? "Game not found", notFound: true };
  }
  if (!res.ok) {
    return { ok: false, error: (data as GameApiError).error ?? `Request failed (${res.status})` };
  }
  return { ok: true, data: data as PlayResponse };
}

/** POST /games/:id/play – play one card. Returns state + intermediate_plays, round_just_ended for animation. */
export async function submitPlay(
  gameId: string,
  body: SubmitPlayBody
): Promise<{ ok: true; data: PlayResponse } | { ok: false; error: string; notFound?: boolean }> {
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
    return { ok: false, error: (data as GameApiError).error ?? "Game not found", notFound: true };
  }
  if (!res.ok) {
    return { ok: false, error: (data as GameApiError).error ?? `Request failed (${res.status})` };
  }
  return { ok: true, data: data as PlayResponse };
}

// ── Stats ──────────────────────────────────────────────────────────────

export type UserStatsResponse = {
  games_played: number;
  games_won: number;
  moon_shots: number;
  best_score: number | null;
  worst_score: number | null;
  average_score: number | null;
};

export async function fetchStats(
  token: string
): Promise<{ ok: true; data: UserStatsResponse } | { ok: false; error: string }> {
  const res = await fetch(`${base()}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson<{ stats: UserStatsResponse } & GameApiError>(res);
  if (!res.ok) {
    return { ok: false, error: (data as GameApiError).error ?? `Request failed (${res.status})` };
  }
  return { ok: true, data: (data as { stats: UserStatsResponse }).stats };
}

export async function recordGameStats(
  token: string,
  body: { game_id: string; final_score: number; won: boolean; moon_shots: number }
): Promise<{ ok: true; data: UserStatsResponse } | { ok: false; error: string }> {
  const res = await fetch(`${base()}/stats/record`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ stats: UserStatsResponse } & GameApiError>(res);
  if (!res.ok) {
    return { ok: false, error: (data as GameApiError).error ?? `Request failed (${res.status})` };
  }
  return { ok: true, data: (data as { stats: UserStatsResponse }).stats };
}
