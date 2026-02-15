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
            <div className="flex gap-5 items-center">
               <form>
                  <FormInput
                     type="text"
                     name="lobby_code"
                     placeholder="Lobby Code"
                     width="160px"
                     fontWeight={600}
                     inputStyle={{ padding: "5px 12px" }}
                  />
               </form>
               <Tooltip content="Coming soon!">
                  <div className="inline-block">
                     <Button
                        name="Join"
                        disabled
                        style={{ width: "100px", height: "30px" }}
                     />
                  </div>
               </Tooltip>
            </div>
            <br />
            <LoginWarning />
            <ButtonGroup padding="tight" className="pt-5">
               <Link href="/">
                  <Button name="Home" style={{ width: "150px" }} />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
