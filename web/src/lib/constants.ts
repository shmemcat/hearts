import type { CurrentTrickSlot } from "@/types/game";

/* ── Validation ──────────────────────────────────────────────────────── */

export const MIN_PASSWORD_LEN = 8;
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,64}$/;

/* ── Auth ─────────────────────────────────────────────────────────────── */

export const STORAGE_KEY = "hearts_token";

/* ── Preferences ─────────────────────────────────────────────────────── */

export const CARD_STYLE_KEY = "hearts_card_style";
export const SOUND_MUTED_KEY = "hearts_sound_muted";
export const SOUND_VOLUME_KEY = "hearts_sound_volume";
export const HARD_LEVEL_KEY = "hearts_hard_level";
export const HARD_LEVEL_CHANGED_KEY = "hearts_hard_level_changed";

/* ── Card / Game ──────────────────────────────────────────────────────── */

export const SUIT_SYMBOL: Record<string, string> = {
   c: "♣",
   d: "♦",
   s: "♠",
   h: "♥",
};

export const SUIT_RED = new Set(["d", "h"]);

export const RANK_ORDER: Record<string, number> = {
   "2": 2,
   "3": 3,
   "4": 4,
   "5": 5,
   "6": 6,
   "7": 7,
   "8": 8,
   "9": 9,
   "10": 10,
   J: 11,
   Q: 12,
   K: 13,
   A: 14,
};

/* ── UI Interaction ───────────────────────────────────────────────────── */

/** Minimum ms between confetti bursts on the rules page. */
export const CONFETTI_COOLDOWN_MS = 1000;

/* ── Animation Timing (ms) ────────────────────────────────────────────── */

/** How long all 4 cards are shown before the collect sweep begins. */
export const HOLD_MS = 1000;
/** Delay before each queued card reveal (turn highlight → card appears). */
export const CARD_DELAY_MS = 500;
/** Duration of the collect-to-winner sweep animation (matches Trick COLLECT_DURATION + buffer). */
export const COLLECT_MS = 450;
/** Extra time the heart-delta badge lingers after the sweep finishes. */
export const BADGE_LINGER_MS = 550;
/** Duration of the empty-board flash between tricks. */
export const CLEAR_MS = 300;
/** Duration of the collect-to-winner card sweep in Trick. */
export const COLLECT_DURATION = 350;

/* ── Layout ───────────────────────────────────────────────────────────── */

/** PageLayout body classes without top margin (mt-10) for play page layout. */
export const PLAY_PAGE_LAYOUT_CLASS =
   "w-full px-2 flex flex-col items-center justify-center text-center";

/* ── Play Queue ───────────────────────────────────────────────────────── */

export const EMPTY_SLOTS: readonly CurrentTrickSlot[] = Object.freeze([
   null,
   null,
   null,
   null,
]);

export function emptySlots(): CurrentTrickSlot[] {
   return [null, null, null, null];
}
