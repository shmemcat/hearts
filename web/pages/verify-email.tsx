import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import type { VerifyEmailQuery } from "@/types/api";
import { Button } from "@/components/buttons";
import { PageLayout, ButtonGroup } from "@/components/ui";

const getApiUrl = () =>
   typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : "http://localhost:5001";

export default function VerifyEmailPage() {
   const router = useRouter();
   const { token } = router.query as VerifyEmailQuery;
   const [status, setStatus] = useState<"loading" | "success" | "error">(
      "loading"
   );
   const [message, setMessage] = useState("");

   useEffect(() => {
      if (!token || typeof token !== "string") {
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
         <Head>
            <title>Verify email | Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
         <PageLayout title="VERIFY EMAIL">
            {status === "loading" && <p>Verifying…</p>}
            {status === "success" && <div>{message}</div>}
            {status === "error" && <div>{message}</div>}
            <ButtonGroup>
               <Link href="/user">
                  <Button name="Sign in" />
               </Link>
               <Link href="/">
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
