/**
 * WebSocket client for game events: connect by gameId, send advance/play,
 * subscribe to play, trick_complete, state, error. Used by the play page with REST fallback.
 */

import { io, Socket } from "socket.io-client";
import { getApiUrl } from "@/lib/api";
import type { GameState, PlayEvent } from "@/types/game";

export type GameSocketState = GameState & { round_just_ended?: boolean };

let socket: Socket | null = null;
let currentGameId: string | null = null;

type PlayCb = (ev: PlayEvent) => void;
type TrickCompleteCb = () => void;
type StateCb = (state: GameSocketState) => void;
type ErrorCb = (message: string) => void;

const playListeners: PlayCb[] = [];
const trickCompleteListeners: TrickCompleteCb[] = [];
const stateListeners: StateCb[] = [];
const errorListeners: ErrorCb[] = [];

export function connect(gameId: string): void {
  if (currentGameId === gameId && socket?.connected) return;
  disconnect();
  const baseUrl = getApiUrl();
  currentGameId = gameId;
  socket = io(`${baseUrl}/game`, {
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
    const msg = typeof data?.message === "string" ? data.message : "WebSocket error";
    errorListeners.forEach((cb) => cb(msg));
  });
}

export function disconnect(): void {
  if (socket) {
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
