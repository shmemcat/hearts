import type { Socket } from "socket.io-client";

export const HEARTS_SOCKET_PATH = "/hearts/socket.io";
export const RELOAD_MESSAGE =
   "This page has been updated. Please reload to reconnect.";

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
