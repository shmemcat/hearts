/**
 * Client for game API: start, get state, submit pass, submit play.
 */

import { getApiUrl } from "@/lib/api";
import type {
  GameState,
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

/** POST /games/:id/play – play one card */
export async function submitPlay(
  gameId: string,
  body: SubmitPlayBody
): Promise<{ ok: true; data: GameState } | { ok: false; error: string; notFound?: boolean }> {
  const res = await fetch(
    `${base()}/games/${encodeURIComponent(gameId)}/play`,
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
