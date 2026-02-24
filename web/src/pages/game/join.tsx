import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import React from "react";

import { Button } from "@/components/Buttons";
import { FormInput } from "@/components/FormInput";
import { ActiveGameModal } from "@/components/game";
import { LoginWarning } from "@/components/LoginWarning";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { checkActiveGame, concedeGame } from "@/lib/gameApi";
import { getLobbyState, checkMultiplayerGameActive } from "@/lib/lobbyApi";
import {
   findActiveMultiplayerSession,
   clearMultiplayerSession,
   type ActiveMultiplayerSession,
} from "@/lib/multiplayerSession";

export default function JoinGamePage() {
   const navigate = useNavigate();
   const { token } = useAuth();
   const [lobbyCode, setLobbyCode] = React.useState("");
   const [submitting, setSubmitting] = React.useState(false);
   const [error, setError] = React.useState<string | null>(null);
   const [activeGameId, setActiveGameId] = React.useState<string | null>(null);
   const [showActiveModal, setShowActiveModal] = React.useState(false);
   const [multiSession, setMultiSession] =
      React.useState<ActiveMultiplayerSession | null>(null);
   const [showMultiModal, setShowMultiModal] = React.useState(false);

   React.useEffect(() => {
      if (!token) return;
      checkActiveGame(token).then((res) => {
         if (res.ok && res.game_id) {
            setActiveGameId(res.game_id);
            setShowActiveModal(true);
         }
      });
   }, [token]);

   React.useEffect(() => {
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

   async function handleJoin() {
      const code = lobbyCode.trim().toUpperCase();
      if (!code) return;
      setError(null);
      setSubmitting(true);
      try {
         const result = await getLobbyState(code);
         if (!result.ok) {
            setError(result.error);
            return;
         }
         navigate(`/game/lobby/${code}`);
      } catch (e) {
         setError(e instanceof Error ? e.message : "Failed to check lobby");
      } finally {
         setSubmitting(false);
      }
   }

   return (
      <>
         <Helmet>
            <title>Join Game | Hearts</title>
         </Helmet>
         <PageLayout title="JOIN GAME">
            <h2>Enter the lobby code</h2>
            <p>
               The game host can provide you with a code, or simply visit the
               game lobby link.
            </p>
            <br />
            <div className="flex items-center">
               <form
                  onSubmit={(e) => {
                     e.preventDefault();
                     handleJoin();
                  }}
               >
                  <FormInput
                     type="text"
                     name="lobby_code"
                     placeholder="Lobby Code"
                     fontWeight={600}
                     value={lobbyCode}
                     onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setLobbyCode(e.target.value)
                     }
                  />
               </form>
            </div>
            {error && (
               <p className="mt-2 text-red-600 text-sm" role="alert">
                  {error}
               </p>
            )}
            <LoginWarning />
            <ButtonGroup padding="tight" className="pt-2">
               <Button
                  name={submitting ? "Joining…" : "Join!"}
                  disabled={submitting || !lobbyCode.trim()}
                  style={{ width: "150px", height: "50px" }}
                  onClick={handleJoin}
               />
               <Link to="/" onClick={() => triggerLogoFadeOut()}>
                  <Button
                     name="Home"
                     style={{ width: "150px", marginTop: "8px" }}
                  />
               </Link>
            </ButtonGroup>
         </PageLayout>
         {showActiveModal && activeGameId && (
            <ActiveGameModal
               onContinue={() =>
                  navigate(
                     `/game/play?game_id=${encodeURIComponent(activeGameId)}`
                  )
               }
               onConcede={handleConcedeActive}
            />
         )}
         {showMultiModal && multiSession && !showActiveModal && (
            <ActiveGameModal
               title={
                  multiSession.type === "lobby"
                     ? "Lobby In Progress"
                     : "Multiplayer Game In Progress"
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
