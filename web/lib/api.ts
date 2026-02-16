/**
 * API base URL for game and auth calls. Reuse NEXT_PUBLIC_API_URL (default localhost:5001).
 */
export function getApiUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://localhost:5001";
}
