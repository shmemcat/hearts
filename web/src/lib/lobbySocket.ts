/**
 * Socket.IO client for the /lobby namespace.
 */

import { io, Socket } from "socket.io-client";
import { HEARTS_SOCKET_PATH, handleConnectionError } from "./transport";
import type {
   LobbyState,
   JoinAckEvent,
   GameStartedEvent,
   LobbySessionEvent,
} from "@/types/lobby";

let socket: Socket | null = null;

type LobbyUpdateCb = (state: LobbyState) => void;
type JoinAckCb = (event: JoinAckEvent) => void;
type GameStartedCb = (event: GameStartedEvent) => void;
type ErrorCb = (message: string) => void;
type LobbyClosedCb = () => void;
type LobbySessionCb = (event: LobbySessionEvent) => void;

const lobbyUpdateListeners: LobbyUpdateCb[] = [];
const joinAckListeners: JoinAckCb[] = [];
const gameStartedListeners: GameStartedCb[] = [];
const errorListeners: ErrorCb[] = [];
const lobbyClosedListeners: LobbyClosedCb[] = [];
const lobbySessionListeners: LobbySessionCb[] = [];
const disconnectListeners: LobbyClosedCb[] = [];

export function connectLobby(code: string, playerToken?: string): void {
   disconnect();
   const query: Record<string, string> = { lobby_code: code };
   if (playerToken) query.player_token = playerToken;

   const connection = io("/lobby", {
      path: HEARTS_SOCKET_PATH,
      query,
      auth: { ...query },
      forceNew: true,
      transports: ["websocket", "polling"],
      autoConnect: false,
   });
   socket = connection;

   const rememberToken = (token: string | null) => {
      const identity: Record<string, string> = { lobby_code: code };
      if (token) identity.player_token = token;
      connection.auth = { ...identity };
      connection.io.opts.query = identity;
   };

   socket.on("lobby_update", (data: LobbyState) => {
      lobbyUpdateListeners.forEach((cb) => cb(data));
   });
   socket.on("join_ack", (data: JoinAckEvent) => {
      // The server already assigned this connection its seat. Keep the token
      // for automatic reconnects without opening a second connection.
      rememberToken(data.player_token);
      joinAckListeners.forEach((cb) => cb(data));
   });
   socket.on("lobby_session", (data: LobbySessionEvent) => {
      rememberToken(data.player_token);
      lobbySessionListeners.forEach((cb) => cb(data));
   });
   socket.on("disconnect", () => {
      disconnectListeners.forEach((cb) => cb());
   });
   socket.on("game_started", (data: GameStartedEvent) => {
      gameStartedListeners.forEach((cb) => cb(data));
   });
   socket.on("lobby_closed", () => {
      lobbyClosedListeners.forEach((cb) => cb());
   });
   socket.on("error", (data: { message?: string }) => {
      const msg =
         typeof data?.message === "string" ? data.message : "Lobby error";
      errorListeners.forEach((cb) => cb(msg));
   });
   connection.on("connect_error", (error) =>
      handleConnectionError(connection, error, (message) =>
         errorListeners.forEach((cb) => cb(message))
      )
   );
   connection.connect();
}

export function disconnect(): void {
   if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
   }
}

export function sendJoin(
   name: string,
   icon?: string,
   seatPreference?: number
): void {
   if (socket?.connected)
      socket.emit("join", { name, icon, seat_preference: seatPreference });
}

export function sendLeave(): void {
   if (socket?.connected) socket.emit("leave");
}

export function sendStartGame(difficulty: string): void {
   if (socket?.connected) socket.emit("start_game", { difficulty });
}

export function sendCloseLobby(): void {
   if (socket?.connected) socket.emit("close_lobby");
}

function makeSubscriber<T>(listeners: T[]) {
   return (cb: T): (() => void) => {
      listeners.push(cb);
      return () => {
         const i = listeners.indexOf(cb);
         if (i !== -1) listeners.splice(i, 1);
      };
   };
}

export const onLobbyUpdate = makeSubscriber(lobbyUpdateListeners);
export const onJoinAck = makeSubscriber(joinAckListeners);
export const onGameStarted = makeSubscriber(gameStartedListeners);
export const onLobbyClosed = makeSubscriber(lobbyClosedListeners);
export const onError = makeSubscriber(errorListeners);
export const onLobbySession = makeSubscriber(lobbySessionListeners);
export const onDisconnect = makeSubscriber(disconnectListeners);
