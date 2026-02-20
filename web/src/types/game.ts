/**
 * Types for the game API: state from GET /games/:id and bodies for start/pass/play.
 */

export type GamePhase = "passing" | "playing";
export type PassDirection = "left" | "right" | "across" | "none";

export type GamePlayer = {
   name: string;
   score: number;
   card_count: number;
};

export type CurrentTrickSlot = {
   player_index: number;
   card: string;
} | null;

/** Response from GET /games/:id and from POST pass / POST play */
export type GameState = {
   phase: GamePhase;
   round: number;
   pass_direction: PassDirection;
   players: GamePlayer[];
   human_hand: string[];
   legal_plays: string[];
   current_trick: CurrentTrickSlot[];
   whose_turn: number;
   hearts_broken: boolean;
   game_over: boolean;
   winner_index: number | null;
   human_moon_shots: number;
};

/** Response from POST /games/start */
export type StartGameResponse = {
   game_id: string;
};

/** Body for POST /games/start (optional) */
export type StartGameBody = {
   player_name?: string;
   difficulty?: string;
};

/** Body for POST /games/:id/pass */
export type SubmitPassBody = {
   cards: [string, string, string];
};

/** Body for POST /games/:id/play */
export type SubmitPlayBody = {
   card: string;
};

/** One play in the sequence (human then AIs) after a submit_play. */
export type PlayEvent = {
   player_index: number;
   card: string;
};

/** POST /games/:id/play response includes state plus animation hints. */
export type PlayResponse = GameState & {
   intermediate_plays?: PlayEvent[];
   round_just_ended?: boolean;
};
