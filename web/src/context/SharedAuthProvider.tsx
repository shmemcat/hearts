import React, { useCallback, useEffect, useState } from "react";
import {
   COOKIE_SESSION,
   getSharedSession,
   sharedAccountRequest,
   type SharedSession,
} from "@/lib/sharedAccount";
import { AuthContext } from "./AuthContext";

export function SharedAuthProvider({
   children,
}: {
   children: React.ReactNode;
}) {
   const [session, setSession] = useState<SharedSession>({
      user: null,
      csrf_token: "",
   });
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState("");
   const refresh = useCallback(async () => {
      try {
         setSession(await getSharedSession());
         setError("");
      } catch {
         setError("Unable to reach your account. Please try again.");
      } finally {
         setLoading(false);
      }
   }, []);
   useEffect(() => {
      void refresh();
      const changed = (event: Event) =>
         setSession((event as CustomEvent<SharedSession>).detail);
      const recheck = () => {
         if (document.visibilityState !== "hidden") void refresh();
      };
      window.addEventListener("focus", recheck);
      window.addEventListener("pageshow", recheck);
      window.addEventListener("cards:session", changed);
      return () => {
         window.removeEventListener("focus", recheck);
         window.removeEventListener("pageshow", recheck);
         window.removeEventListener("cards:session", changed);
      };
   }, [refresh]);
   const login = async (username: string, password: string) => {
      try {
         setSession(
            await sharedAccountRequest("login", {
               username: username.trim(),
               password,
            })
         );
         setError("");
         return {};
      } catch (error) {
         return {
            error:
               error instanceof Error ? error.message : "Unable to sign in.",
         };
      }
   };
   const logout = async () => {
      try {
         setSession(await sharedAccountRequest("logout"));
         setError("");
      } catch {
         setError("Unable to sign out. Please try again.");
      }
   };
   const user = session.user;
   return (
      <AuthContext.Provider
         value={{
            user,
            token: user ? COOKIE_SESSION : null,
            preferences: user?.preferences || null,
            status: loading
               ? "loading"
               : user
               ? "authenticated"
               : "unauthenticated",
            error,
            login,
            logout,
            updateUser: (partial) =>
               setSession((previous) => ({
                  ...previous,
                  user: previous.user ? { ...previous.user, ...partial } : null,
               })),
         }}
      >
         {children}
      </AuthContext.Provider>
   );
}
