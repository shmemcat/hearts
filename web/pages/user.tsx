import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

import { Button } from "@/components/Buttons";
import { FormInput } from "@/components/FormInput";
import { StyledLink } from "@/components/StyledLink";
import {
   PageLayout,
   FormContainer,
   ErrorMessage,
   ButtonGroup,
} from "@/components/ui";

export default function UserPage() {
   return (
      <>
         <Head>
            <title>User | Hearts</title>
         </Head>
         <PageLayout title="USER">
            <UserInfo />
         </PageLayout>
      </>
   );
}

function UserInfo() {
   const { user, status, login, logout } = useAuth();
   const [username, setUsername] = useState("");
   const [password, setPassword] = useState("");
   const [error, setError] = useState("");
   const [fieldError, setFieldError] = useState<{
      username?: string;
      password?: string;
   }>({});
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
      return (
         <div className="mt-10 w-[85vw] flex flex-col items-center justify-center text-center">
            Loading…
         </div>
      );
   }

   if (user) {
      return (
         <>
            <div>Welcome {user.name ?? user.email}!</div>
            <ButtonGroup padding="loose">
               <Button name="Sign Out" onClick={() => logout()} />
               <Link href="/">
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </>
      );
   }

   return (
      <>
         <div>Sign in with your username and password.</div>

         <FormContainer onSubmit={handleSignIn} noValidate>
            <FormInput
               type="text"
               placeholder="Username"
               value={username}
               onChange={(e) => {
                  setUsername(e.target.value);
                  setFieldError((prev) =>
                     prev.username ? { ...prev, username: undefined } : prev
                  );
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
                  setFieldError((prev) =>
                     prev.password ? { ...prev, password: undefined } : prev
                  );
               }}
               autoComplete="current-password"
               error={fieldError.password}
            />
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <div>
               <Button
                  name={loading ? "Signing in…" : "Sign In"}
                  disabled={loading}
               />
            </div>
         </FormContainer>

         <div className="mt-5">
            <StyledLink href="/register">Create an account</StyledLink>
         </div>

         <ButtonGroup className="pt-7">
            <Link href="/">
               <Button name="Home" />
            </Link>
         </ButtonGroup>
      </>
   );
}
