import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   connectLobby,
   disconnect,
   onLobbySession,
   sendCloseLobby,
} from "./lobbySocket";

const transport = vi.hoisted(() => {
   const makeSocket = () => {
      const handlers: Record<string, (data?: unknown) => void> = {};
      return {
         handlers,
         connected: false,
         auth: {} as Record<string, string>,
         io: { opts: { query: {} as Record<string, string> } },
         on: vi.fn((event: string, cb: (data?: unknown) => void) => {
            handlers[event] = cb;
         }),
         connect: vi.fn(),
         disconnect: vi.fn(),
         removeAllListeners: vi.fn(),
         emit: vi.fn(),
      };
   };
   return { makeSocket, io: vi.fn() };
});

vi.mock("socket.io-client", () => ({ io: transport.io }));

let socket: ReturnType<typeof transport.makeSocket>;
const subscriptions: (() => void)[] = [];

beforeEach(() => {
   vi.clearAllMocks();
   socket = transport.makeSocket();
   transport.io.mockReturnValue(socket);
});

afterEach(() => {
   disconnect();
   subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
});

describe("lobby connections", () => {
   it("sends the saved identity in namespace auth and receives initial confirmation", () => {
      const confirmed = vi.fn();
      subscriptions.push(onLobbySession(confirmed));
      const session = { player_token: "host-token", seat_index: 0 };
      socket.connect.mockImplementation(() => {
         socket.handlers.lobby_session(session);
      });

      connectLobby("ABC123", "host-token");

      expect(transport.io).toHaveBeenCalledWith(
         "/lobby",
         expect.objectContaining({
            path: "/hearts/socket.io",
            auth: { lobby_code: "ABC123", player_token: "host-token" },
         })
      );
      expect(confirmed).toHaveBeenCalledWith(session);
   });
   it("shows a reload requirement without restarting a retired transport", async () => {
      const { onError } = await import("./lobbySocket");
      const error = vi.fn();
      subscriptions.push(onError(error));
      connectLobby("ABC123");
      socket.handlers.connect_error({
         data: { code: "CLIENT_RELOAD_REQUIRED" },
      });
      expect(socket.disconnect).toHaveBeenCalledOnce();
      expect(error).toHaveBeenCalledWith(
         "This page has been updated. Please reload to reconnect."
      );
   });

   it("cancels an unfinished connection when leaving or returning", () => {
      connectLobby("ABC123", "host-token");
      expect(socket.connected).toBe(false);
      const abandoned = socket;
      socket = transport.makeSocket();
      transport.io.mockReturnValue(socket);

      connectLobby("ABC123", "host-token");

      expect(abandoned.disconnect).toHaveBeenCalledOnce();
      expect(abandoned.removeAllListeners).toHaveBeenCalledOnce();
      disconnect();
      expect(socket.disconnect).toHaveBeenCalledOnce();
   });

   it("keeps a joined seat on the current socket and on automatic reconnects", () => {
      connectLobby("ABC123");
      socket.connected = true;
      socket.handlers.join_ack({ player_token: "guest-token", seat_index: 1 });

      expect(socket.auth).toEqual({
         lobby_code: "ABC123",
         player_token: "guest-token",
      });
      expect(socket.io.opts.query).toEqual(socket.auth);
      expect(transport.io).toHaveBeenCalledOnce();
      expect(socket.disconnect).not.toHaveBeenCalled();
      sendCloseLobby();
      expect(socket.emit).toHaveBeenCalledWith("close_lobby");
   });

   it("drops invalid credentials from subsequent reconnects", () => {
      connectLobby("ABC123", "expired-token");
      socket.handlers.lobby_session({ player_token: null, seat_index: null });

      expect(socket.auth).toEqual({ lobby_code: "ABC123" });
      expect(socket.io.opts.query).toEqual({ lobby_code: "ABC123" });
   });
});
