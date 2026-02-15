import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import type { ResetPasswordQuery } from "@/types/api";
import { Button } from "@/components/buttons";
import { StyledLink } from "@/components/StyledLink";
import {
   PageLayout,
   FormContainer,
   ErrorMessage,
   ButtonGroup,
} from "@/components/ui";

const MIN_PASSWORD_LEN = 8;

export default function ResetPasswordPage() {
   const router = useRouter();
   const { token } = router.query as ResetPasswordQuery;
   const [password, setPassword] = useState("");
   const [confirmPassword, setConfirmPassword] = useState("");
   const [error, setError] = useState("");
   const [success, setSuccess] = useState(false);
   const [loading, setLoading] = useState(false);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (password.length < MIN_PASSWORD_LEN) {
         setError(`Password must be at least ${MIN_PASSWORD_LEN} characters`);
         return;
      }
      if (password !== confirmPassword) {
         setError("Passwords do not match");
         return;
      }
      if (!token || typeof token !== "string") {
         setError("Invalid reset link");
         return;
      }
      setLoading(true);
      try {
         const res = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password }),
         });
         const data = await res.json().catch(() => ({}));
         if (!res.ok) {
            setError((data.error as string) || "Reset failed");
            setLoading(false);
            return;
         }
         setSuccess(true);
      } catch {
         setError("Something went wrong");
      }
      setLoading(false);
   };

   return (
      <>
         <Head>
            <title>Reset password | Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
         <PageLayout title="RESET PASSWORD">
            {success ? (
               <p className="text-heartslogo">
                  Password updated. You can sign in now.
               </p>
            ) : (
               <>
                  <p>Enter your new password.</p>
                  <FormContainer onSubmit={handleSubmit} className="gap-3">
                     <input
                        type="password"
                        placeholder="New password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={MIN_PASSWORD_LEN}
                        autoComplete="new-password"
                        className="px-3 py-2"
                     />
                     <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={MIN_PASSWORD_LEN}
                        autoComplete="new-password"
                        className="px-3 py-2"
                     />
                     {error && <ErrorMessage>{error}</ErrorMessage>}
                     <Button
                        name={loading ? "Updating…" : "Update password"}
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
