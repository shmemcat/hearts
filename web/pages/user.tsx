import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons";
import { HeartsLogo } from "@/components/heartslogo";
import { Navbar } from "@/components/navbar";
import { FormInput } from "@/components/FormInput";
import { StyledLink } from "@/components/StyledLink";

export default function UserPage() {
   return (
      <>
         <Head>
            <title>User | Hearts</title>
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
                  <h1 style={{ marginTop: "-180px" }}>USER</h1>
               </div>

               <UserInfo />
            </div>
         </div>
      </>
   );
}

function UserInfo() {
   const { user, status, login, logout } = useAuth();
   const [username, setUsername] = useState("");
   const [password, setPassword] = useState("");
   const [error, setError] = useState("");
   const [fieldError, setFieldError] = useState<{ username?: string; password?: string }>({});
   const [loading, setLoading] = useState(false);

   const handleSignIn = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setFieldError({});
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
         setFieldError({ username: "Please enter your username." });
         return;
      }
      if (!password) {
         setFieldError({ password: "Please enter your password." });
         return;
      }
      setLoading(true);
      const result = await login(trimmedUsername, password);
      setLoading(false);
      if (result.error) {
         setError(result.error);
         return;
      }
      setUsername("");
      setPassword("");
   };

   if (status === "loading") {
      return <div className={containers["body-container"]}>Loading…</div>;
   }

   if (user) {
      return (
         <div className={containers["body-container"]}>
            <div>Welcome {user.name ?? user.email}!</div>

            <div
               className={containers["button-container"]}
               style={{ paddingTop: "40px" }}
            >
               <Button name="Sign Out" onClick={() => logout()} />
               <Link href="/">
                  <Button name="Home" />
               </Link>
            </div>
         </div>
      );
   }

   return (
      <div className={containers["body-container"]}>
         <div>Sign in with your username and password.</div>

         <form
            onSubmit={handleSignIn}
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
                  setFieldError((prev) => (prev.username ? { ...prev, username: undefined } : prev));
               }}
               autoComplete="username"
               error={fieldError.username}
            />
            <FormInput
               type="password"
               placeholder="Password"
               value={password}
               onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldError((prev) => (prev.password ? { ...prev, password: undefined } : prev));
               }}
               autoComplete="current-password"
               error={fieldError.password}
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
            <div>
               <Button
                  name={loading ? "Signing in…" : "Sign In"}
                  disabled={loading}
                  onClick={() => {}}
               />
            </div>
         </form>

         <div style={{ marginTop: "20px" }}>
            <StyledLink href="/register">Create an account</StyledLink>
         </div>

         <div
            className={containers["button-container"]}
            style={{ paddingTop: "28px" }}
         >
            <Link href="/">
               <Button name="Home" />
            </Link>
         </div>
      </div>
   );
}
