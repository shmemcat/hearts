import { getApiUrl } from "@/lib/api";
import { STORAGE_KEY } from "@/lib/constants";

export type SharedUser = {
   id: string;
   name: string;
   email: string;
   profile_icon?: string;
   turn_sound?: Partial<Record<"golf" | "euchre" | "hearts", boolean>>;
   email_verified: boolean;
   preferences_available?: boolean;
   preferences?: {
      card_style: string;
      hard_level: string;
      mobile_layout: string;
   } | null;
};
export type SharedSession = {
   user: SharedUser | null;
   csrf_token: string;
   message?: string;
};
// A compatibility marker for existing game API arguments, never an authentication credential.
export const COOKIE_SESSION = "cards-session";
let observedSession: SharedSession | undefined;
let pendingSession: Promise<SharedSession> | undefined;

export function sharedAccountsEnabled() {
   const value = import.meta.env.VITE_SHARED_ACCOUNTS;
   return (
      value === "true" ||
      (value !== "false" &&
         import.meta.env.DEV &&
         import.meta.env.MODE !== "test")
   );
}

export function getAuthToken(): string | null {
   if (sharedAccountsEnabled())
      return observedSession?.user ? COOKIE_SESSION : null;
   try {
      return localStorage.getItem(STORAGE_KEY);
   } catch {
      return null;
   }
}

export function getSharedSession(): Promise<SharedSession> {
   if (!pendingSession) {
      pendingSession = globalThis
         .fetch(`${getApiUrl()}/account/session`, {
            credentials: "same-origin",
            cache: "no-store",
         })
         .then(async (response) => {
            const data = await response.json();
            if (
               !response.ok ||
               typeof data.csrf_token !== "string" ||
               !(data.user === null || typeof data.user?.id === "string")
            )
               throw new Error(data.error || "Unable to reach your account.");
            observedSession = data;
            return data as SharedSession;
         })
         .finally(() => {
            pendingSession = undefined;
         });
   }
   return pendingSession;
}

export async function sharedAccountRequest(
   path: string,
   data: unknown = {},
   expectedUserId?: string
): Promise<SharedSession> {
   const session = await getSharedSession();
   if (expectedUserId && session.user?.id !== expectedUserId)
      throw new Error("Your account changed. Please refresh and try again.");
   const response = await globalThis.fetch(`${getApiUrl()}/account/${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
         "Content-Type": "application/json",
         "X-CSRF-Token": session.csrf_token,
      },
      body: JSON.stringify(data),
   });
   const result = await response.json();
   if (!response.ok)
      throw new Error(result.error || "Unable to update your account.");
   if (typeof result.csrf_token !== "string")
      throw new Error("Unexpected account response.");
   observedSession = result;
   window.dispatchEvent(new CustomEvent("cards:session", { detail: result }));
   return result;
}

/** Same-origin Hearts API calls use cookies and CSRF in shared mode; legacy deployments retain JWT behavior. */
export async function cardsFetch(
   input: RequestInfo | URL,
   init?: RequestInit
): Promise<Response> {
   const url = new URL(
      typeof input === "string"
         ? input
         : input instanceof URL
         ? input.href
         : input.url,
      window.location.href
   );
   if (
      !sharedAccountsEnabled() ||
      url.origin !== window.location.origin ||
      !url.pathname.startsWith("/api/")
   )
      return init === undefined
         ? globalThis.fetch(input)
         : globalThis.fetch(input, init);
   const authPaths = [
      "register",
      "verify-email",
      "forgot-password",
      "reset-password",
      "resend-verification",
   ];
   if (authPaths.some((path) => url.pathname === `/api/${path}`))
      url.pathname = url.pathname.replace("/api/", "/api/account/");
   const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined)
   );
   headers.delete("Authorization");
   const method = (
      init?.method || (input instanceof Request ? input.method : "GET")
   ).toUpperCase();
   if (!["GET", "HEAD", "OPTIONS"].includes(method))
      headers.set("X-CSRF-Token", (await getSharedSession()).csrf_token);
   const options = {
      ...init,
      method,
      headers,
      credentials: "same-origin" as const,
   };
   if (input instanceof Request) {
      const source = new Request(input, init);
      return globalThis.fetch(
         new Request(url.href, {
            cache: source.cache,
            mode: source.mode,
            redirect: source.redirect,
            referrer: source.referrer,
            referrerPolicy: source.referrerPolicy,
            integrity: source.integrity,
            keepalive: source.keepalive,
            signal: source.signal,
            ...options,
            body: source.body ? await source.arrayBuffer() : undefined,
         })
      );
   }
   return globalThis.fetch(url.href, options);
}
