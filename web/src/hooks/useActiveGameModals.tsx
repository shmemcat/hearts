import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { ActiveGameModal } from "@/components/game";
import { useAuth } from "@/context/AuthContext";
import { checkActiveGame, concedeGame } from "@/lib/gameApi";
import { getLobbyState, checkMultiplayerGameActive } from "@/lib/lobbyApi";
import {
   findActiveMultiplayerSession,
   clearMultiplayerSession,
   type ActiveMultiplayerSession,
} from "@/lib/multiplayerSession";

export function useActiveGameModals(): ReactNode {
   const navigate = useNavigate();
   const { token } = useAuth();
   const [activeGameId, setActiveGameId] = useState<string | null>(null);
   const [showActiveModal, setShowActiveModal] = useState(false);
   const [multiSession, setMultiSession] =
      useState<ActiveMultiplayerSession | null>(null);
   const [showMultiModal, setShowMultiModal] = useState(false);

   useEffect(() => {
      if (!token) return;
      checkActiveGame(token).then((res) => {
         if (res.ok && res.game_id) {
            setActiveGameId(res.game_id);
            setShowActiveModal(true);
         }
      });
   }, [token]);

   useEffect(() => {
      const session = findActiveMultiplayerSession();
      if (!session) return;
      if (session.type === "lobby") {
         getLobbyState(session.code).then((res) => {
            if (res.ok && res.data.status !== "finished") {
               setMultiSession(session);
               setShowMultiModal(true);
            } else {
               clearMultiplayerSession(session);
            }
         });
      } else {
         checkMultiplayerGameActive(session.gameId).then((active) => {
            if (active) {
               setMultiSession(session);
               setShowMultiModal(true);
            } else {
               clearMultiplayerSession(session);
            }
         });
      }
   }, []);

   async function handleConcedeActive() {
      if (!activeGameId) return;
      await concedeGame(activeGameId, token);
      setActiveGameId(null);
      setShowActiveModal(false);
   }

   return (
      <>
         {showActiveModal && activeGameId && (
            <ActiveGameModal
               onContinue={() =>
                  navigate(
                     `/game/single-play?game_id=${encodeURIComponent(
                        activeGameId
                     )}`
                  )
               }
               onConcede={handleConcedeActive}
            />
         )}
         {showMultiModal && multiSession && !showActiveModal && (
            <ActiveGameModal
               title={
                  multiSession.type === "lobby" ? (
                     "Lobby In Progress"
                  ) : (
                     <>
                        Multiplayer Game
                        <br />
                        In Progress
                     </>
                  )
               }
               message={
                  multiSession.type === "lobby"
                     ? "You have an active lobby. Rejoin?"
                     : "You have a multiplayer game in progress. Rejoin?"
               }
               continueLabel="Rejoin"
               concedeLabel="Leave"
               confirmMessage={
                  multiSession.type === "lobby"
                     ? "Are you sure you want to leave the lobby?"
                     : "Are you sure you want to leave the game? Your seat will be taken over by a bot."
               }
               onContinue={() => {
                  if (multiSession.type === "lobby") {
                     navigate(`/game/lobby/${multiSession.code}`);
                  } else {
                     navigate(
                        `/game/multi-play?game_id=${encodeURIComponent(
                           multiSession.gameId
                        )}`
                     );
                  }
               }}
               onConcede={() => {
                  clearMultiplayerSession(multiSession);
                  setMultiSession(null);
                  setShowMultiModal(false);
               }}
            />
         )}
      </>
   );
}
