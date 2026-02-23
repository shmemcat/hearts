/**
 * REST client for lobby endpoints.
 */

import { getApiUrl } from "@/lib/api";
import type { LobbyState } from "@/types/lobby";

const base = () => getApiUrl();

export type CreateLobbyResponse = {
   code: string;
   url: string;
   player_token: string;
};

export async function createLobby(
   hostName: string,
   numAi: number = 0
): Promise<
   { ok: true; data: CreateLobbyResponse } | { ok: false; error: string }
> {
   const res = await fetch(`${base()}/lobbies/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host_name: hostName, num_ai: numAi }),
   });
   const data = await res.json().catch(() => ({}));
   if (!res.ok) {
      return {
         ok: false,
         error: data.error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: data as CreateLobbyResponse };
}

export async function getLobbyState(
   code: string
): Promise<{ ok: true; data: LobbyState } | { ok: false; error: string }> {
   const res = await fetch(`${base()}/lobbies/${encodeURIComponent(code)}`);
   const data = await res.json().catch(() => ({}));
   if (!res.ok) {
      return {
         ok: false,
         error: data.error ?? `Request failed (${res.status})`,
      };
   }
   return { ok: true, data: data as LobbyState };
}
