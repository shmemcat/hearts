/**
 * API base URL for game and auth calls. Proxied through nginx (prod) or Vite dev server (dev).
 */
export function getApiUrl(): string {
   return import.meta.env.VITE_API_URL || "/api";
}

/** Game-owned APIs have their own gateway prefix; accounts keep the shared base. */
export function getGameApiUrl(): string {
   return `${getApiUrl().replace(/\/$/, "")}/hearts`;
}
