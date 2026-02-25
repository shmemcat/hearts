/**
 * WebSocket client for game events: connect by gameId, send advance/play,
 * subscribe to play, trick_complete, state, error. Used by the play page with REST fallback.
 */

import { io, Socket } from "socket.io-client";
import type { GameState, PlayEvent } from "@/types/game";

export type GameSocketState = GameState & { round_just_ended?: boolean };

let socket: Socket | null = null;
let currentGameId: string | null = null;

type PlayCb = (ev: PlayEvent) => void;
type TrickCompleteCb = () => void;
type StateCb = (state: GameSocketState) => void;
type ErrorCb = (message: string) => void;
type VoidCb = () => void;

const playListeners: PlayCb[] = [];
const trickCompleteListeners: TrickCompleteCb[] = [];
const stateListeners: StateCb[] = [];
const errorListeners: ErrorCb[] = [];
const disconnectListeners: VoidCb[] = [];
const reconnectListeners: VoidCb[] = [];

export function connect(gameId: string): void {
   if (currentGameId === gameId && socket?.connected) return;
   disconnect();
   currentGameId = gameId;
   socket = io("/game", {
      path: "/socket.io",
      query: { game_id: gameId },
      transports: ["websocket", "polling"],
      autoConnect: true,
   });
   socket.on("play", (ev: PlayEvent) => {
      playListeners.forEach((cb) => cb(ev));
   });
   socket.on("trick_complete", () => {
      trickCompleteListeners.forEach((cb) => cb());
   });
   socket.on("state", (state: GameSocketState) => {
      stateListeners.forEach((cb) => cb(state));
   });
   socket.on("error", (data: { message?: string }) => {
      const msg =
         typeof data?.message === "string" ? data.message : "WebSocket error";
      errorListeners.forEach((cb) => cb(msg));
   });
   socket.on("disconnect", () => {
      disconnectListeners.forEach((cb) => cb());
   });
   socket.io.on("reconnect", () => {
      reconnectListeners.forEach((cb) => cb());
   });
}

export function disconnect(): void {
   if (socket) {
      socket.io.removeAllListeners();
      socket.removeAllListeners();
      if (socket.connected) {
         socket.disconnect();
      }
      socket = null;
   }
   currentGameId = null;
}

export function isConnected(): boolean {
   return socket?.connected ?? false;
}

export function sendAdvance(): void {
   if (socket?.connected) socket.emit("advance");
}

export function sendPlay(card: string): void {
   if (socket?.connected) socket.emit("play", { card });
}

export function onPlay(cb: PlayCb): () => void {
   playListeners.push(cb);
   return () => {
      const i = playListeners.indexOf(cb);
      if (i !== -1) playListeners.splice(i, 1);
   };
}

export function onTrickComplete(cb: TrickCompleteCb): () => void {
   trickCompleteListeners.push(cb);
   return () => {
      const i = trickCompleteListeners.indexOf(cb);
      if (i !== -1) trickCompleteListeners.splice(i, 1);
   };
}

export function onState(cb: StateCb): () => void {
   stateListeners.push(cb);
   return () => {
      const i = stateListeners.indexOf(cb);
      if (i !== -1) stateListeners.splice(i, 1);
   };
}

export function onError(cb: ErrorCb): () => void {
   errorListeners.push(cb);
   return () => {
      const i = errorListeners.indexOf(cb);
      if (i !== -1) errorListeners.splice(i, 1);
   };
}

export function onDisconnect(cb: VoidCb): () => void {
   disconnectListeners.push(cb);
   return () => {
      const i = disconnectListeners.indexOf(cb);
      if (i !== -1) disconnectListeners.splice(i, 1);
   };
}

export function onReconnect(cb: VoidCb): () => void {
   reconnectListeners.push(cb);
   return () => {
      const i = reconnectListeners.indexOf(cb);
      if (i !== -1) reconnectListeners.splice(i, 1);
   };
}
