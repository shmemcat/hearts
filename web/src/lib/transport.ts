import type { Socket } from "socket.io-client";

export const HEARTS_SOCKET_PATH = "/hearts/socket.io";
export const RELOAD_MESSAGE =
   "This page has been updated. Please reload to reconnect.";

/** Restore a suspended phone's transport and request the latest server state. */
export function resumeOnWake(reconnect: () => void, refresh: () => void) {
   const visible = () => {
      if (document.visibilityState !== "hidden") reconnect();
   };
   const focus = () => {
      if (document.visibilityState !== "hidden") refresh();
   };
   const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) visible();
      else focus();
   };
   document.addEventListener("visibilitychange", visible);
   window.addEventListener("online", visible);
   window.addEventListener("focus", focus);
   window.addEventListener("pageshow", pageshow);
   return () => {
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", visible);
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", pageshow);
   };
}

/** A future retired transport must ask for a reload instead of retrying forever. */
export function handleConnectionError(
   socket: Socket,
   error: Error & { data?: { code?: string } },
   notify: (message: string) => void
) {
   if (error.data?.code !== "CLIENT_RELOAD_REQUIRED") return;
   socket.disconnect();
   notify(RELOAD_MESSAGE);
}
