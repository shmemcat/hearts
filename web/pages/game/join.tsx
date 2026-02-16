import Head from "next/head";
import Link from "next/link";

import { Button } from "@/components/buttons";
import { FormInput } from "@/components/FormInput";
import { LoginWarning } from "@/components/loginwarning";
import { Tooltip } from "@/components/Tooltip";
import { PageLayout, ButtonGroup } from "@/components/ui";

export default function JoinGamePage() {
   return (
      <>
         <Head>
            <title>Join Game | Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
            <meta name="description" content="Hearts web application" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
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
               <Link href="/">
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
