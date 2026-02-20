import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
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

export default function ResendVerificationPage() {
   const [email, setEmail] = useState("");
   const [sent, setSent] = useState(false);
   const [error, setError] = useState("");
   const [loading, setLoading] = useState(false);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
         const res = await fetch(`${getApiUrl()}/resend-verification`, {
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
         <Helmet>
            <title>Resend verification | Hearts</title>
         </Helmet>
         <PageLayout title="RESEND VERIFICATION">
            {sent ? (
               <p>
                  If that email is registered and unverified, we sent a new
                  verification link. Check your inbox and spam folder.
               </p>
            ) : (
               <>
                  <p>
                     Enter your email and we&apos;ll send a new verification
                     link.
                  </p>
                  <FormContainer onSubmit={handleSubmit}>
                     <FormInput
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                     />
                     {error && <ErrorMessage>{error}</ErrorMessage>}
                     <Button
                        name={loading ? "Sending…" : "Resend verification"}
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
