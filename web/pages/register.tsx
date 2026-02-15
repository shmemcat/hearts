import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons";
import { HeartsLogo } from "@/components/heartslogo";
import { Navbar } from "@/components/navbar";
import { FormInput } from "@/components/FormInput";
import { StyledLink } from "@/components/StyledLink";

const MIN_PASSWORD_LEN = 8;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,64}$/;

const getApiUrl = () =>
   typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : "http://localhost:5001";

export default function RegisterPage() {
   const router = useRouter();
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
            username: "Username must be 3–64 characters, letters, numbers, and underscores only.",
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
         <Head>
            <title>Register | Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
            <meta name="description" content="Hearts web application" />
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
                  <h1 style={{ marginTop: "-180px" }}>REGISTER</h1>
               </div>

               <div className={containers["body-container"]}>
                  {success ? (
                     <div>
                        <StyledLink href="/user">Sign in</StyledLink>
                     </div>
                  ) : (
                     <form
                        onSubmit={handleSubmit}
                        noValidate
                        style={{
                           display: "flex",
                           flexDirection: "column",
                           gap: "16px",
                           maxWidth: "280px",
                           marginTop: "20px",
                        }}
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
                                 prev.email
                                    ? { ...prev, email: undefined }
                                    : prev
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
                           name={
                              loading ? "Creating account…" : "Create account"
                           }
                           disabled={loading}
                           onClick={() => {}}
                        />
                     </form>
                  )}

                  <div style={{ marginTop: "16px" }}>
                     <StyledLink href="/user">
                        Already have an account? Sign in
                     </StyledLink>
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
