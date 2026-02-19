import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/Buttons";
import { FormInput } from "@/components/FormInput";
import { StyledLink } from "@/components/StyledLink";
import {
   PageLayout,
   FormContainer,
   ErrorMessage,
   ButtonGroup,
} from "@/components/ui";

import { triggerLogoFadeOut } from "@/components/Navbar";
import { getApiUrl } from "@/lib/api";
import { MIN_PASSWORD_LEN, USERNAME_RE } from "@/lib/constants";

export default function RegisterPage() {
   const navigate = useNavigate();
   const [username, setUsername] = useState("");
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [confirmPassword, setConfirmPassword] = useState("");
   const [error, setError] = useState("");
   const [fieldError, setFieldError] = useState<{
      username?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
   }>({});
   const [loading, setLoading] = useState(false);
   const [success, setSuccess] = useState(false);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setFieldError({});
      const trimmedUsername = username.trim();
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedUsername) {
         setFieldError({ username: "Please enter a username." });
         return;
      }
      if (!USERNAME_RE.test(trimmedUsername)) {
         setFieldError({
            username:
               "Username must be 3–64 characters, letters, numbers, and underscores only.",
         });
         return;
      }
      if (!trimmedEmail) {
         setFieldError({ email: "Please enter your email." });
         return;
      }
      if (password.length < MIN_PASSWORD_LEN) {
         setFieldError({
            password: `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
         });
         return;
      }
      if (password !== confirmPassword) {
         setFieldError({ confirmPassword: "Passwords do not match." });
         return;
      }
      setLoading(true);
      try {
         const res = await fetch(`${getApiUrl()}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               username: trimmedUsername,
               email: trimmedEmail,
               password,
            }),
         });
         const data = await res.json().catch(() => ({}));
         if (!res.ok) {
            setError((data.error as string) || "Registration failed");
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
            <title>Register | Hearts</title>
         </Helmet>
         <PageLayout title="REGISTER">
            {success ? (
               <div className="text-center">
                  <p className="mb-2">Account created!</p>
                  <StyledLink href="/user">Sign in</StyledLink>
               </div>
            ) : (
               <>
                  <FormContainer
                     onSubmit={handleSubmit}
                     noValidate
                     topMargin={false}
                  >
                     <FormInput
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => {
                           setUsername(e.target.value);
                           setFieldError((prev) =>
                              prev.username
                                 ? { ...prev, username: undefined }
                                 : prev
                           );
                        }}
                        autoComplete="username"
                        error={fieldError.username}
                     />
                     <FormInput
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => {
                           setEmail(e.target.value);
                           setFieldError((prev) =>
                              prev.email ? { ...prev, email: undefined } : prev
                           );
                        }}
                        autoComplete="email"
                        error={fieldError.email}
                     />
                     <FormInput
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => {
                           setPassword(e.target.value);
                           setFieldError((prev) =>
                              prev.password
                                 ? { ...prev, password: undefined }
                                 : prev
                           );
                        }}
                        autoComplete="new-password"
                        error={fieldError.password}
                     />
                     <FormInput
                        type="password"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => {
                           setConfirmPassword(e.target.value);
                           setFieldError((prev) =>
                              prev.confirmPassword
                                 ? { ...prev, confirmPassword: undefined }
                                 : prev
                           );
                        }}
                        autoComplete="new-password"
                        error={fieldError.confirmPassword}
                     />
                     {error && <ErrorMessage>{error}</ErrorMessage>}
                     <Button
                        name={loading ? "Creating account…" : "Create account"}
                        disabled={loading}
                     />
                  </FormContainer>

                  <div className="mt-4">
                     <StyledLink href="/user">
                        Already have an account? Sign in
                     </StyledLink>
                  </div>
               </>
            )}

            <ButtonGroup className="mt-2">
               <Link to="/" onClick={() => triggerLogoFadeOut()}>
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
