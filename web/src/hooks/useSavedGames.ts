import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { listSavedGames, type HeartsSave } from "@/lib/savedGames";
import { concedeGame } from "@/lib/gameApi";
import { concedeMultiplayerGame } from "@/lib/lobbyApi";
import { clearMultiplayerSession } from "@/lib/multiplayerSession";
import type { SavedGameCard } from "@/components/InProgressGames";

export function useSavedGames() {
   const { user, token } = useAuth();
   const owner = user?.id ?? "guest";
   const [lookup, setLookup] = useState<{ owner: string; games: HeartsSave[] }>(
      { owner, games: [] }
   );
   const [loading, setLoading] = useState(true),
      [error, setError] = useState("");
   const [attempt, setAttempt] = useState(0);
   const retry = () => setAttempt((n) => n + 1);
   useEffect(() => {
      const refresh = () => retry();
      window.addEventListener("focus", refresh);
      window.addEventListener("online", refresh);
      window.addEventListener("storage", refresh);
      return () => {
         window.removeEventListener("focus", refresh);
         window.removeEventListener("online", refresh);
         window.removeEventListener("storage", refresh);
      };
   }, []);
   useEffect(() => {
      let alive = true;
      setLoading(true);
      setError("");
      void listSavedGames(owner, token)
         .then((games) => {
            if (alive) setLookup({ owner, games });
         })
         .catch((e) => {
            if (alive) setError(e.message);
         })
         .finally(() => {
            if (alive) setLoading(false);
         });
      return () => {
         alive = false;
      };
   }, [owner, token, attempt]);
   const entries = lookup.owner === owner ? lookup.games : [];
   const games: SavedGameCard[] = entries.map((game) => ({
      id: game.id,
      title: game.multiplayer
         ? `Table ${game.code ?? game.id.slice(0, 6)}`
         : `Bot game · ${game.difficulty}`,
      mode: game.multiplayer ? "Multiplayer" : "Bots",
      progress: `Round ${game.round} · ${
         game.scores?.[game.seat ?? 0] ?? 0
      } points`,
      status: game.multiplayer
         ? game.your_turn
            ? "Your turn"
            : "Waiting for a player"
         : "Ready to resume",
      multiplayer: game.multiplayer,
      concedeMessage: "Concede this game? Your other games stay saved.",
   }));
   return {
      games,
      loading,
      error,
      retry,
      resume(id: string) {
         const game = entries.find((g) => g.id === id);
         if (!game) return null;
         if (game.multiplayer) {
            localStorage.setItem(`hearts_mp_token_${id}`, game.player_token!);
            localStorage.setItem(`hearts_mp_seat_${id}`, String(game.seat));
            if (game.code)
               localStorage.setItem(`hearts_mp_lobby_${id}`, game.code);
            return `/game/multi-play?game_id=${encodeURIComponent(id)}`;
         }
         return `/game/single-play?game_id=${encodeURIComponent(id)}`;
      },
      async concede(id: string) {
         const game = entries.find((g) => g.id === id);
         if (!game) return;
         if (game.multiplayer) {
            const result = await concedeMultiplayerGame(id, game.player_token!);
            if (!result.ok) throw new Error(result.error);
            clearMultiplayerSession({ type: "game", gameId: id });
         } else {
            const result = await concedeGame(id, token);
            if (!result.ok) throw new Error(result.error);
         }
         setLookup((old) => ({
            ...old,
            games: old.games.filter((g) => g.id !== id),
         }));
         retry();
      },
   };
}
