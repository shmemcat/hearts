import Head from "next/head";
import Link from "next/link";

import { Button } from "@/components/buttons";
import { CreateGameSelections } from "@/components/radiobuttons";
import { LoginWarning } from "@/components/loginwarning";
import { Tooltip } from "@/components/Tooltip";
import { PageLayout, ButtonGroup } from "@/components/ui";

export default function CreateGamePage() {
   return (
      <>
         <Head>
            <title>Create Game | Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
            <meta name="description" content="Hearts web application" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
         <PageLayout title="CREATE GAME">
            <div className="flex flex-col">
               <CreateGameSelections />

               <div className="pt-4 mt-4">
                  <Tooltip content="Coming soon!">
                     <div className="inline-block">
                        <Button
                           name="Create Game!"
                           disabled
                           style={{ height: "50px" }}
                        />
                     </div>
                  </Tooltip>
               </div>
               <LoginWarning />
               <ButtonGroup className="pt-0">
                  <Link href="/">
                     <Button name="Home" style={{ width: "120px" }} />
                  </Link>
               </ButtonGroup>
            </div>
         </PageLayout>
      </>
   );
}
