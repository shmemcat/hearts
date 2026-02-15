import Head from "next/head";
import Link from "next/link";

import { Button } from "@/components/buttons";
import { PageLayout, ButtonGroup } from "@/components/ui";

export default function Custom404() {
   return (
      <>
         <Head>
            <title>404 | Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
            <meta name="description" content="Hearts web application" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
         <PageLayout title="404">
            <div>Page not found!</div>
            <ButtonGroup padding="tight">
               <Link href="/">
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
