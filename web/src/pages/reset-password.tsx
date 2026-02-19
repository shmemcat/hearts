import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";

import { triggerLogoFadeOut } from "@/components/Navbar";
import { getApiUrl } from "@/lib/api";
import { Button } from "@/components/Buttons";
import { FormInput } from "@/components/FormInput";
import { StyledLink } from "@/components/StyledLink";
import {
   PageLayout,
   FormContainer,
   ErrorMessage,
   ButtonGroup,
} from "@/components/ui";
import { MIN_PASSWORD_LEN } from "@/lib/constants";

export default function ResetPasswordPage() {
   const [searchParams] = useSearchParams();
   const token = searchParams.get("token") ?? "";
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
      if (!token) {
         setError("Invalid reset link");
         return;
      }
      setLoading(true);
      try {
         const res = await fetch(`${getApiUrl()}/reset-password`, {
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
         <Helmet>
            <title>Reset password | Hearts</title>
         </Helmet>
         <PageLayout title="RESET PASSWORD">
            {success ? (
               <p className="text-heartslogo">
                  Password updated. You can sign in now.
               </p>
            ) : (
               <>
                  <p>Enter your new password.</p>
                  <FormContainer onSubmit={handleSubmit} className="gap-3">
                     <FormInput
                        type="password"
                        placeholder="New password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                     />
                     <FormInput
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                     />
                     {error && <ErrorMessage>{error}</ErrorMessage>}
                     <Button
                        name={loading ? "Updating…" : "Update password"}
                        disabled={loading}
                     />
                  </FormContainer>
               </>
            )}
            <div className="mt-4">
               <StyledLink href="/user">Back to sign in</StyledLink>
            </div>
            <ButtonGroup>
               <Link to="/" onClick={() => triggerLogoFadeOut()}>
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
