import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { Button } from "@/components/Buttons";
import { FormInput } from "@/components/FormInput";
import { LoginWarning } from "@/components/LoginWarning";
import { Tooltip } from "@/components/Tooltip";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";

export default function JoinGamePage() {
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
               <form>
                  <FormInput
                     type="text"
                     name="lobby_code"
                     placeholder="Lobby Code"
                     fontWeight={600}
                  />
               </form>
            </div>
            <LoginWarning />
            <ButtonGroup padding="tight" className="pt-2">
               <Tooltip content="Coming soon!">
                  <div className="inline-block">
                     <Button
                        name="Join!"
                        disabled
                        style={{ width: "150px", height: "50px" }}
                     />
                  </div>
               </Tooltip>
               <Link to="/" onClick={() => triggerLogoFadeOut()}>
                  <Button
                     name="Home"
                     style={{ width: "150px", marginTop: "8px" }}
                  />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
