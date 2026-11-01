import { cardsFetch } from "./sharedAccount";
import { getGameApiUrl } from "./api";

export type HeartsSave = {
   id: string;
   multiplayer: boolean;
   code?: string;
   difficulty: string;
   round: number;
   scores?: number[];
   seat?: number | null;
   player_token?: string;
   your_turn?: boolean;
};
const botKey = (owner: string) => `hearts.saved-bots.v1:${owner}`;
export function rememberBotGame(id: string, owner: string) {
   try {
      const ids: string[] = JSON.parse(
         localStorage.getItem(botKey(owner)) || "[]"
      );
      localStorage.setItem(
         botKey(owner),
         JSON.stringify([...new Set([...ids, id])])
      );
   } catch {
      /* Server saves remain available for signed-in players. */
   }
}
export async function listSavedGames(
   owner: string,
   token?: string | null
): Promise<HeartsSave[]> {
   const headers: Record<string, string> = {};
   if (token) headers.Authorization = `Bearer ${token}`;
   let path = "/games/saved",
      init: RequestInit = { headers, cache: "no-store" };
   if (owner === "guest") {
      const memberships: { id?: string; token?: string }[] = [];
      try {
         for (const id of JSON.parse(
            localStorage.getItem(botKey(owner)) || "[]"
         ))
            memberships.push({ id });
         for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (key.startsWith("hearts_mp_token_"))
               memberships.push({
                  id: key.slice(16),
                  token: localStorage.getItem(key) ?? undefined,
               });
         }
      } catch {
         /* Storage can be unavailable in private browser sessions. */
      }
      if (!memberships.length) return [];
      path = "/games/saved-guest";
      init = {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ memberships: memberships.slice(-100) }),
      };
   }
   const response = await cardsFetch(`${getGameApiUrl()}${path}`, init);
   const data = await response.json();
   if (!response.ok || !Array.isArray(data.games))
      throw new Error(data.error || "Couldn’t load your saved games.");
   return data.games;
}
