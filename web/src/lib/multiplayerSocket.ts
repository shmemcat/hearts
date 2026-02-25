/**
 * Socket.IO client for the /multi namespace (multiplayer gameplay).
 */

import { io, Socket } from "socket.io-client";
import type { GameState, PlayEvent } from "@/types/game";

let socket: Socket | null = null;

type StateCb = (state: GameState) => void;
type PlayCb = (event: PlayEvent) => void;
type VoidCb = () => void;
type PlayerConcededCb = (data: {
   seat_index: number;
   name: string;
   reason?: string;
}) => void;
type ErrorCb = (message: string) => void;

const stateListeners: StateCb[] = [];
const playListeners: PlayCb[] = [];
const trickCompleteListeners: VoidCb[] = [];
const passReceivedListeners: ((data: { seat_index: number }) => void)[] = [];
const playerConcededListeners: PlayerConcededCb[] = [];
const gameTerminatedListeners: VoidCb[] = [];
const gameOverListeners: StateCb[] = [];
const errorListeners: ErrorCb[] = [];
const idleWarningListeners: VoidCb[] = [];

export function connectMulti(
   gameId: string,
   playerToken?: string | null
): void {
   disconnect();
   const query: Record<string, string> = { game_id: gameId };
   if (playerToken) query.player_token = playerToken;

   socket = io("/multi", {
      path: "/socket.io",
      query,
      forceNew: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
   });

   socket.on("state", (data: GameState) => {
      stateListeners.forEach((cb) => cb(data));
   });
   socket.on("play", (data: PlayEvent) => {
      playListeners.forEach((cb) => cb(data));
   });
   socket.on("trick_complete", () => {
      trickCompleteListeners.forEach((cb) => cb());
   });
   socket.on("pass_received", (data: { seat_index: number }) => {
      passReceivedListeners.forEach((cb) => cb(data));
   });
   socket.on(
      "player_conceded",
      (data: { seat_index: number; name: string; reason?: string }) => {
         playerConcededListeners.forEach((cb) => cb(data));
      }
   );
   socket.on("idle_warning", () => {
      idleWarningListeners.forEach((cb) => cb());
   });
   socket.on("game_terminated", () => {
      gameTerminatedListeners.forEach((cb) => cb());
   });
   socket.on("game_over", (data: GameState) => {
      gameOverListeners.forEach((cb) => cb(data));
   });
   socket.on("error", (data: { message?: string }) => {
      const msg =
         typeof data?.message === "string" ? data.message : "Multiplayer error";
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

export function isConnected(): boolean {
   return socket?.connected ?? false;
}

export function sendRequestState(): void {
   if (socket?.connected) socket.emit("request_state");
}

export function sendPlay(card: string): void {
   if (socket?.connected) socket.emit("play", { card });
}

export function sendPass(cards: string[]): void {
   if (socket?.connected) socket.emit("pass", { cards });
}

export function sendConcede(cb?: (data: { status: string }) => void): void {
   if (socket?.connected) {
      socket.emit("concede", cb);
   } else if (cb) {
      cb({ status: "error" });
   }
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

export const onState = makeSubscriber(stateListeners);
export const onPlay = makeSubscriber(playListeners);
export const onTrickComplete = makeSubscriber(trickCompleteListeners);
export const onPassReceived = makeSubscriber(passReceivedListeners);
export const onPlayerConceded = makeSubscriber(playerConcededListeners);
export const onIdleWarning = makeSubscriber(idleWarningListeners);
export const onGameTerminated = makeSubscriber(gameTerminatedListeners);
export const onGameOver = makeSubscriber(gameOverListeners);
export const onError = makeSubscriber(errorListeners);
