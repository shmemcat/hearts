import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/Buttons";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { getApiUrl } from "@/lib/api";

export default function VerifyEmailPage() {
   const [searchParams] = useSearchParams();
   const token = searchParams.get("token") ?? "";
   const [status, setStatus] = useState<"loading" | "success" | "error">(
      "loading"
   );
   const [message, setMessage] = useState("");

   useEffect(() => {
      if (!token) {
         setStatus("error");
         setMessage("Missing verification link.");
         return;
      }
      fetch(`${getApiUrl()}/verify-email`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ token }),
      })
         .then((res) => res.json())
         .then((data) => {
            if (data.message) {
               setStatus("success");
               setMessage("Your email is verified. You can sign in now.");
            } else {
               setStatus("error");
               setMessage((data.error as string) || "Verification failed.");
            }
         })
         .catch(() => {
            setStatus("error");
            setMessage("Something went wrong.");
         });
   }, [token]);

   return (
      <>
         <Helmet>
            <title>Verify email | Hearts</title>
         </Helmet>
         <PageLayout title="VERIFY EMAIL">
            {status === "loading" && <p>Verifying…</p>}
            {status === "success" && <div>{message}</div>}
            {status === "error" && <div>{message}</div>}
            <ButtonGroup>
               <Link to="/user">
                  <Button name="Sign in" />
               </Link>
               <Link to="/" onClick={() => triggerLogoFadeOut()}>
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
