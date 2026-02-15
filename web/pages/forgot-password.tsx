import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons";
import { HeartsLogo } from "@/components/heartslogo";
import { Navbar } from "@/components/navbar";
import { StyledLink } from "@/components/StyledLink";

export default function ForgotPasswordPage() {
   const [email, setEmail] = useState("");
   const [sent, setSent] = useState(false);
   const [error, setError] = useState("");
   const [loading, setLoading] = useState(false);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
         const res = await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim().toLowerCase() }),
         });
         const data = await res.json().catch(() => ({}));
         if (!res.ok) {
            setError((data.error as string) || "Something went wrong");
            setLoading(false);
            return;
         }
         setSent(true);
      } catch {
         setError("Something went wrong");
      }
      setLoading(false);
   };

   return (
      <>
         <Head>
            <title>Forgot password | Hearts</title>
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
                  <h1 style={{ marginTop: "-180px" }}>FORGOT PASSWORD</h1>
               </div>
               <div className={containers["body-container"]}>
                  {sent ? (
                     <p>
                        If that email is registered, we sent a reset link. Check
                        your inbox and spam folder.
                     </p>
                  ) : (
                     <>
                        <p>
                           Enter your email and we&apos;ll send a reset link.
                        </p>
                        <form
                           onSubmit={handleSubmit}
                           style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "16px",
                              maxWidth: "280px",
                              marginTop: "20px",
                           }}
                        >
                           <input
                              type="email"
                              placeholder="Email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              autoComplete="email"
                              style={{ padding: "8px 12px" }}
                           />
                           {error && (
                              <span
                                 style={{
                                    color: "var(--warningicon, #c00)",
                                    fontSize: "14px",
                                 }}
                              >
                                 {error}
                              </span>
                           )}
                           <Button
                              name={loading ? "Sending…" : "Send reset link"}
                              disabled={loading}
                              onClick={() => {}}
                           />
                        </form>
                     </>
                  )}
                  <div style={{ marginTop: "16px" }}>
                     <StyledLink href="/user">Back to sign in</StyledLink>
                  </div>
                  <div
                     className={containers["button-container"]}
                     style={{ paddingTop: "24px" }}
                  >
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
