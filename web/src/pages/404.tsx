import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { Button } from "@/components/Buttons";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";

export default function Custom404() {
   return (
      <>
         <Helmet>
            <title>404 | Hearts</title>
         </Helmet>
         <PageLayout title="404">
            <div>Page not found!</div>
            <ButtonGroup padding="tight">
               <Link to="/" onClick={() => triggerLogoFadeOut()}>
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
