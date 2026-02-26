/**
 * Types for the lobby system.
 */

export type SeatStatus = "empty" | "human" | "ai";

export type LobbySeat = {
   index: number;
   status: SeatStatus;
   name?: string;
   icon?: string;
};

export type LobbyState = {
   code: string;
   host_token: string;
   seats: LobbySeat[];
   status: "waiting" | "playing" | "finished";
   game_id: string | null;
};

export type JoinAckEvent = {
   seat_index: number;
   player_token: string;
};

export type GameStartedEvent = {
   game_id: string;
   difficulty: string;
   seat_assignments: { seat_index: number; player_token: string }[];
   seats: LobbySeat[];
};
