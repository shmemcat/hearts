import React, { createContext, useContext, useEffect, useState } from "react";

import { getApiUrl } from "@/lib/api";
import { STORAGE_KEY } from "@/lib/constants";

type User = { id: string; email: string; name?: string };

type AuthState = {
   user: User | null;
   token: string | null;
   status: "loading" | "authenticated" | "unauthenticated";
};

function decodeJwtPayload(
   token: string
): { sub?: string; username?: string; email?: string; exp?: number } | null {
   if (typeof atob === "undefined") return null;
   try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = atob(base64);
      return JSON.parse(json) as {
         sub?: string;
         username?: string;
         email?: string;
         exp?: number;
      };
   } catch {
      return null;
   }
}

function userFromToken(token: string): User | null {
   const payload = decodeJwtPayload(token);
   if (!payload?.sub) return null;
   if (payload.exp && payload.exp * 1000 < Date.now()) return null; // expired
   return {
      id: payload.sub,
      email: payload.email ?? "",
      name: payload.username ?? payload.email ?? "",
   };
}

type AuthContextValue = AuthState & {
   login: (email: string, password: string) => Promise<{ error?: string }>;
   logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
   const [state, setState] = useState<AuthState>({
      user: null,
      token: null,
      status: "loading",
   });

   useEffect(() => {
      const token =
         typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null;
      if (!token) {
         setState({ user: null, token: null, status: "unauthenticated" });
         return;
      }
      const user = userFromToken(token);
      if (!user) {
         localStorage.removeItem(STORAGE_KEY);
         setState({ user: null, token: null, status: "unauthenticated" });
         return;
      }
      setState({ user, token, status: "authenticated" });
   }, []);

   const login = async (
      username: string,
      password: string
   ): Promise<{ error?: string }> => {
      const trimmedUsername = username.trim();
      const res = await fetch(`${getApiUrl()}/login`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ username: trimmedUsername, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === "EMAIL_NOT_VERIFIED") {
         return {
            error: "Check your email to verify your account before signing in.",
         };
      }
      if (!res.ok) {
         return {
            error: (data.error as string) || "Invalid email or password",
         };
      }
      const token = data.token;
      const user = data.user;
      if (!token || !user) return { error: "Invalid response" };
      if (typeof window !== "undefined")
         localStorage.setItem(STORAGE_KEY, token);
      setState({
         user: {
            id: String(user.id),
            email: user.email,
            name: user.username ?? user.name ?? user.email,
         },
         token,
         status: "authenticated",
      });
      return {};
   };

   const logout = () => {
      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
      setState({ user: null, token: null, status: "unauthenticated" });
   };

   const value: AuthContextValue = { ...state, login, logout };

   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
   const ctx = useContext(AuthContext);
   if (!ctx) throw new Error("useAuth must be used within AuthProvider");
   return ctx;
}
