import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons";
import { HeartsLogo } from "@/components/heartslogo";
import { Navbar } from "@/components/navbar";

const getApiUrl = () =>
   typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : "http://localhost:5001";

export default function VerifyEmailPage() {
   const router = useRouter();
   const { token } = router.query;
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
         <div className={containers["content-border-container"]}>
            <Navbar />
            <div className={containers["container"]}>
               <div className={containers["title-container"]}>
                  <HeartsLogo
                     style={{
                        marginTop: "30px",
                        display: "block",
                        marginLeft: "auto",
                        marginRight: "auto",
                        userSelect: "none",
                     }}
                  />
                  <h1 style={{ marginTop: "-180px" }}>VERIFY EMAIL</h1>
               </div>
               <div className={containers["body-container"]}>
                  {status === "loading" && <p>Verifying…</p>}
                  {status === "success" && <div>{message}</div>}
                  {status === "error" && <div>{message}</div>}
                  <div
                     className={containers["button-container"]}
                     style={{ paddingTop: "24px" }}
                  >
                     <Link href="/user">
                        <Button name="Sign in" />
                     </Link>
                     <Link href="/">
                        <Button name="Home" />
                     </Link>
                  </div>
               </div>
            </div>
         </div>
      </>
   );
}
