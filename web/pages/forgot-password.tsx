import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/buttons";
import { StyledLink } from "@/components/StyledLink";
import {
   PageLayout,
   FormContainer,
   ErrorMessage,
   ButtonGroup,
} from "@/components/ui";

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
         <PageLayout title="FORGOT PASSWORD">
            {sent ? (
               <p>
                  If that email is registered, we sent a reset link. Check your
                  inbox and spam folder.
               </p>
            ) : (
               <>
                  <p>Enter your email and we&apos;ll send a reset link.</p>
                  <FormContainer onSubmit={handleSubmit}>
                     <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="px-3 py-2"
                     />
                     {error && <ErrorMessage>{error}</ErrorMessage>}
                     <Button
                        name={loading ? "Sending…" : "Send reset link"}
                        disabled={loading}
                        onClick={() => {}}
                     />
                  </FormContainer>
               </>
            )}
            <div className="mt-4">
               <StyledLink href="/user">Back to sign in</StyledLink>
            </div>
            <ButtonGroup>
               <Link href="/">
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
