import Head from "next/head";
import Link from "next/link";

import { Button } from "@/components/Buttons";
import { PageLayout, ButtonGroup } from "@/components/ui";

export default function Custom404() {
   return (
      <>
         <Head>
            <title>404 | Hearts</title>
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
