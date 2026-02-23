/**
 * Shared utilities for both single-player and multiplayer play pages.
 */

/**
 * Reorder for table layout: API order 0,1,2,3 -> display order
 * bottom(0), top(2), left(1), right(3).
 *
 * With an optional `mySeat` offset, rotates so the given seat appears at
 * position 0 (bottom). Used in multiplayer where the local player isn't
 * always seat 0.
 */
export function reorderSlotsForTableLayout<T>(
   arr: T[],
   mySeat: number = 0
): T[] {
   if (arr.length < 4) return arr;
   const rotated = [
      arr[(0 + mySeat) % 4],
      arr[(1 + mySeat) % 4],
      arr[(2 + mySeat) % 4],
      arr[(3 + mySeat) % 4],
   ];
   return [rotated[0], rotated[2], rotated[1], rotated[3]];
}

/**
 * Derive compact badge label for mobile:
 * "AI 1" → "A1", "Bot 1" → "B1", "Guest 1" → "G1", "shmemcat" → "S", "You" → "Y".
 */
export function getShortName(name: string): string {
   const trimmed = name.trim();
   const guestMatch = trimmed.match(/^Guest\s*(\d+)$/i);
   if (guestMatch) return `G${guestMatch[1]}`;
   const botMatch = trimmed.match(/^Bot\s*(\d+)$/i);
   if (botMatch) return `B${botMatch[1]}`;
   if (trimmed === "You") return "Y";
   return trimmed.charAt(0).toUpperCase();
}

/**
 * Detect a shoot-the-moon event from round score deltas.
 * Returns the shooter's seat index, or -1 if no moon shot.
 */
export function detectShootTheMoon(deltas: number[]): number {
   const zeroCount = deltas.filter((d) => d === 0).length;
   const twentySixCount = deltas.filter((d) => d === 26).length;
   if (zeroCount === 1 && twentySixCount === 3) {
      return deltas.indexOf(0);
   }
   return -1;
}

/**
 * Compute round deltas from previous and current scores.
 */
export function computeRoundDeltas(
   prevScores: number[],
   currentScores: { score: number }[]
): number[] {
   return currentScores.map((p, i) => p.score - (prevScores[i] ?? 0));
}

/** Pass transition phase types (shared between single & multi play pages). */
export type PassTransitionState = {
   phase: "exiting" | "gap" | "entering";
   displayHand: string[];
   exitingCodes?: Set<string>;
   exitDir?: "left" | "right" | "up";
   enteringCodes?: Set<string>;
   enterDir?: "left" | "right" | "above";
} | null;
