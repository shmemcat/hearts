/**
 * Socket.IO client for the /lobby namespace.
 */

import { io, Socket } from "socket.io-client";
import type { LobbyState, JoinAckEvent, GameStartedEvent } from "@/types/lobby";

let socket: Socket | null = null;

type LobbyUpdateCb = (state: LobbyState) => void;
type JoinAckCb = (event: JoinAckEvent) => void;
type GameStartedCb = (event: GameStartedEvent) => void;
type ErrorCb = (message: string) => void;
type LobbyClosedCb = () => void;

const lobbyUpdateListeners: LobbyUpdateCb[] = [];
const joinAckListeners: JoinAckCb[] = [];
const gameStartedListeners: GameStartedCb[] = [];
const errorListeners: ErrorCb[] = [];
const lobbyClosedListeners: LobbyClosedCb[] = [];

export function connectLobby(code: string, playerToken?: string): void {
   disconnect();
   const query: Record<string, string> = { lobby_code: code };
   if (playerToken) query.player_token = playerToken;

   socket = io("/lobby", {
      path: "/socket.io",
      query,
      transports: ["websocket", "polling"],
      autoConnect: true,
   });

   socket.on("lobby_update", (data: LobbyState) => {
      lobbyUpdateListeners.forEach((cb) => cb(data));
   });
   socket.on("join_ack", (data: JoinAckEvent) => {
      joinAckListeners.forEach((cb) => cb(data));
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
}

export function disconnect(): void {
   if (socket) {
      socket.removeAllListeners();
      if (socket.connected) socket.disconnect();
      socket = null;
   }
}

export function sendJoin(name: string): void {
   if (socket?.connected) socket.emit("join", { name });
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
