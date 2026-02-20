/**
 * API base URL for game and auth calls. Proxied through nginx (prod) or Vite dev server (dev).
 */
export function getApiUrl(): string {
   return import.meta.env.VITE_API_URL || "/api";
}
