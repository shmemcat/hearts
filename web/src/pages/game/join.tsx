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
import { getLobbyState } from "@/lib/lobbyApi";

export default function JoinGamePage() {
   const navigate = useNavigate();
   const { token } = useAuth();
   const [lobbyCode, setLobbyCode] = React.useState("");
   const [submitting, setSubmitting] = React.useState(false);
   const [error, setError] = React.useState<string | null>(null);
   const [activeGameId, setActiveGameId] = React.useState<string | null>(null);
   const [showActiveModal, setShowActiveModal] = React.useState(false);

   React.useEffect(() => {
      if (!token) return;
      checkActiveGame(token).then((res) => {
         if (res.ok && res.game_id) {
            setActiveGameId(res.game_id);
            setShowActiveModal(true);
         }
      });
   }, [token]);

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
      </>
   );
}
