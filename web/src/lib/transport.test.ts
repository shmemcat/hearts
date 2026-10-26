import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as single from "./gameSocket";
import * as multi from "./multiplayerSocket";

const transport = vi.hoisted(() => ({ io: vi.fn() }));
vi.mock("socket.io-client", () => ({ io: transport.io }));

let handlers: Record<string, (...args: unknown[]) => void>;
let connection: {
   connected: boolean;
   io: {
      on: ReturnType<typeof vi.fn>;
      removeAllListeners: ReturnType<typeof vi.fn>;
   };
   on: ReturnType<typeof vi.fn>;
   disconnect: ReturnType<typeof vi.fn>;
   removeAllListeners: ReturnType<typeof vi.fn>;
};
const cleanup: (() => void)[] = [];

beforeEach(() => {
   handlers = {};
   connection = {
      connected: true,
      io: { on: vi.fn(), removeAllListeners: vi.fn() },
      on: vi.fn((event, callback) => {
         handlers[event] = callback;
      }),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
   };
   transport.io.mockReset().mockReturnValue(connection);
});
afterEach(() => {
   single.disconnect();
   multi.disconnect();
   cleanup.splice(0).forEach((unsubscribe) => unsubscribe());
   vi.restoreAllMocks();
});

it.each([420, -330, 0])(
   "sends the player's local offset %s for multiplayer",
   (offset) => {
      vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(offset);
      multi.connectMulti("game-id", "seat-token");
      expect(transport.io.mock.calls[0][1].query.utc_offset_minutes).toBe(
         String(offset)
      );
   }
);

for (const [namespace, connect, onError] of [
   ["/game", () => single.connect("game-id"), single.onError],
   [
      "/multi",
      () => multi.connectMulti("game-id", "seat-token", "legacy-token"),
      multi.onError,
   ],
] as const) {
   it(`${namespace} retains its namespace and game credentials on the Hearts transport`, () => {
      connect();
      expect(transport.io).toHaveBeenCalledWith(
         namespace,
         expect.objectContaining({
            path: "/hearts/socket.io",
            query: expect.objectContaining({ game_id: "game-id" }),
         })
      );
      if (namespace === "/multi")
         expect(transport.io.mock.calls[0][1].query).toEqual({
            game_id: "game-id",
            player_token: "seat-token",
            auth_token: "legacy-token",
            utc_offset_minutes: String(new Date().getTimezoneOffset()),
         });
   });
   it(`${namespace} retries ordinary failures but surfaces a required reload`, () => {
      const notify = vi.fn();
      cleanup.push(onError(notify));
      connect();
      handlers.connect_error(new Error("Temporary network error"));
      expect(connection.disconnect).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
      handlers.connect_error({ data: { code: "CLIENT_RELOAD_REQUIRED" } });
      expect(connection.disconnect).toHaveBeenCalledOnce();
      expect(notify).toHaveBeenCalledWith(
         "This page has been updated. Please reload to reconnect."
      );
   });
}
