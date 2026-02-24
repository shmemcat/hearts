/**
 * Scan localStorage for active multiplayer lobbies or games.
 */

export type ActiveMultiplayerSession =
   | { type: "lobby"; code: string }
   | { type: "game"; gameId: string };

export function findActiveMultiplayerSession(): ActiveMultiplayerSession | null {
   for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const gameMatch = key.match(/^hearts_mp_token_(.+)$/);
      if (gameMatch) {
         return { type: "game", gameId: gameMatch[1] };
      }

      const lobbyMatch = key.match(/^hearts_lobby_token_(.+)$/);
      if (lobbyMatch) {
         return { type: "lobby", code: lobbyMatch[1] };
      }
   }
   return null;
}

export function clearMultiplayerSession(
   session: ActiveMultiplayerSession
): void {
   if (session.type === "lobby") {
      localStorage.removeItem(`hearts_lobby_token_${session.code}`);
   } else {
      localStorage.removeItem(`hearts_mp_token_${session.gameId}`);
      localStorage.removeItem(`hearts_mp_seat_${session.gameId}`);
   }
}
