import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { fetchStats, type UserStatsResponse } from "@/lib/gameApi";
import containers from "@/styles/containers.module.css";

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
         <div className="mt-8 w-[85vw] flex flex-col items-center justify-center text-center sm:mt-10">
            Loading…
         </div>
      );
   }

   if (user) {
      return (
         <>
            <div className="mb-4">
               Welcome <span className="bold">{user.name ?? user.email}</span>!
            </div>
            <StatsPanel />
            <ButtonGroup padding="loose">
               <Link href="/options">
                  <Button name="Options" />
               </Link>
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

function StatsPanel() {
   const { token } = useAuth();
   const [stats, setStats] = useState<UserStatsResponse | null>(null);

   useEffect(() => {
      if (!token) return;
      fetchStats(token).then((res) => {
         if (res.ok) setStats(res.data);
      });
   }, [token]);

   if (!stats) return null;

   const fmt = (val: number | null | undefined): string =>
      val != null ? String(val) : "--";

   const winRate =
      stats.games_played > 0
         ? `${Math.round((stats.games_won / stats.games_played) * 100)}%`
         : "--";

   return (
      <div className={containers["stats-card"]}>
         <p className={containers["stats-card-title"]}>Your Stats</p>
         <div className={containers["stats-grid"]}>
            <div className={containers["stats-row"]}>
               <span className={containers["stats-label"]}>Games Played</span>
               <span className={containers["stats-value"]}>
                  {fmt(stats.games_played)}
               </span>
            </div>
            <div className={containers["stats-row"]}>
               <span className={containers["stats-label"]}>Games Won</span>
               <span className={containers["stats-value"]}>
                  {fmt(stats.games_won)}
               </span>
            </div>
            <div className={containers["stats-row"]}>
               <span className={containers["stats-label"]}>Win Rate</span>
               <span className={containers["stats-value"]}>{winRate}</span>
            </div>
            <hr className={containers["stats-divider"]} />
            <div className={containers["stats-row"]}>
               <span className={containers["stats-label"]}>Shot the Moon</span>
               <span className={containers["stats-value"]}>
                  {fmt(stats.moon_shots)}
               </span>
            </div>
            <div className={containers["stats-row"]}>
               <span className={containers["stats-label"]}>Best Score</span>
               <span className={containers["stats-value"]}>
                  {fmt(stats.best_score)}
               </span>
            </div>
            <div className={containers["stats-row"]}>
               <span className={containers["stats-label"]}>Worst Score</span>
               <span className={containers["stats-value"]}>
                  {fmt(stats.worst_score)}
               </span>
            </div>
            <div className={containers["stats-row"]}>
               <span className={containers["stats-label"]}>Avg Score</span>
               <span className={containers["stats-value"]}>
                  {fmt(stats.average_score)}
               </span>
            </div>
         </div>
      </div>
   );
}
