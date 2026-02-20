import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, afterEach } from "vitest";
import PlayGamePage from "./play";
import { renderWithProviders, createMockGameState } from "@/test/helpers";
import type { PlayResponse } from "@/types/game";

// ── Mock gameSocket (prevent real socket connections) ─────────────────
vi.mock("@/lib/gameSocket", () => ({
   connect: vi.fn(),
   disconnect: vi.fn(),
   isConnected: vi.fn(() => false),
   onPlay: vi.fn(() => vi.fn()),
   onTrickComplete: vi.fn(() => vi.fn()),
   onState: vi.fn(() => vi.fn()),
   onError: vi.fn(() => vi.fn()),
   sendAdvance: vi.fn(),
   sendPlay: vi.fn(),
}));

// ── Mock gameApi ─────────────────────────────────────────────────────
const mockGetGameState = vi.fn();
const mockSubmitPlay = vi.fn();
vi.mock("@/lib/gameApi", () => ({
   getGameState: (...args: unknown[]) => mockGetGameState(...args),
   submitPlay: (...args: unknown[]) => mockSubmitPlay(...args),
   advanceGame: vi.fn(),
   submitPass: vi.fn(),
   concedeGame: vi.fn(),
   recordGameStats: vi.fn(),
}));

// jsdom doesn't support Web Animations API
if (!HTMLElement.prototype.getAnimations) {
   HTMLElement.prototype.getAnimations = () => [];
}
if (!HTMLElement.prototype.animate) {
   HTMLElement.prototype.animate = () =>
      ({
         cancel: () => {},
         finish: () => {},
         play: () => {},
      } as unknown as Animation);
}

const GAME_ID = "test-game-123";

function makePlayingState() {
   return createMockGameState({
      phase: "playing",
      whose_turn: 0,
      human_hand: ["2c", "5d", "Js", "Ah", "3c", "7h"],
      legal_plays: ["2c", "5d", "Js", "Ah", "3c", "7h"],
      current_trick: [null, null, null, null],
   });
}

/**
 * Render the play page and wait until the playing-phase hand is interactive.
 * The "Your turn" hint only appears when the round banner and deal animation
 * are both finished and it's the human's turn.
 */
async function renderAndWaitForPlayableHand() {
   const user = userEvent.setup();
   renderWithProviders(<PlayGamePage />, {
      route: `/game/play?game_id=${GAME_ID}`,
   });
   await screen.findByText("Your turn", {}, { timeout: 5000 });
   return user;
}

beforeEach(() => {
   mockGetGameState.mockReset();
   mockSubmitPlay.mockReset();
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("PlayGamePage – double-click guard", () => {
   it("ignores a second card click while the first play is still in flight", async () => {
      mockGetGameState.mockResolvedValue({
         ok: true,
         data: makePlayingState(),
      });

      let resolvePlay!: (value: { ok: true; data: PlayResponse }) => void;
      mockSubmitPlay.mockReturnValue(
         new Promise((resolve) => {
            resolvePlay = resolve;
         })
      );

      const user = await renderAndWaitForPlayableHand();

      const card2c = screen.getByRole("button", { name: "Card 2 of c" });
      const card5d = screen.getByRole("button", { name: "Card 5 of d" });

      // Click the first card
      await user.click(card2c);

      expect(mockSubmitPlay).toHaveBeenCalledTimes(1);
      expect(mockSubmitPlay).toHaveBeenCalledWith(GAME_ID, { card: "2c" });

      // Click a second card immediately (before the first play resolves)
      await user.click(card5d);

      // submitPlay should still only have been called once — the guard blocked it
      expect(mockSubmitPlay).toHaveBeenCalledTimes(1);

      // Clean up: resolve the pending promise
      resolvePlay({
         ok: true,
         data: {
            ...createMockGameState({
               phase: "playing",
               whose_turn: 0,
               human_hand: ["5d", "Js", "Ah", "3c", "7h"],
               legal_plays: ["5d", "Js", "Ah", "3c", "7h"],
               current_trick: [
                  { player_index: 0, card: "2c" },
                  null,
                  null,
                  null,
               ],
            }),
            intermediate_plays: [],
         },
      });

      await waitFor(() => {
         expect(mockSubmitPlay).toHaveBeenCalledTimes(1);
      });
   }, 10000);

   it("re-enables play after the in-flight request resolves", async () => {
      mockGetGameState.mockResolvedValue({
         ok: true,
         data: makePlayingState(),
      });

      const nextState = createMockGameState({
         phase: "playing",
         whose_turn: 0,
         human_hand: ["5d", "Js", "Ah", "3c", "7h"],
         legal_plays: ["5d"],
         current_trick: [null, null, null, null],
      });

      mockSubmitPlay.mockResolvedValueOnce({
         ok: true,
         data: { ...nextState, intermediate_plays: [] } as PlayResponse,
      });

      const user = await renderAndWaitForPlayableHand();

      await user.click(screen.getByRole("button", { name: "Card 2 of c" }));
      expect(mockSubmitPlay).toHaveBeenCalledTimes(1);

      // Wait for the response to apply and the guard to reset — we can
      // detect this because "Your turn" reappears after the new state
      // settles.
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Card 5 of d" })
         ).toBeInTheDocument();
      });

      // Set up the next play mock
      mockSubmitPlay.mockResolvedValueOnce({
         ok: true,
         data: {
            ...createMockGameState({
               phase: "playing",
               whose_turn: 0,
               human_hand: ["Js", "Ah", "3c", "7h"],
               legal_plays: ["Js"],
               current_trick: [null, null, null, null],
            }),
            intermediate_plays: [],
         } as PlayResponse,
      });

      // Second card should now be playable (guard was reset)
      await user.click(screen.getByRole("button", { name: "Card 5 of d" }));
      expect(mockSubmitPlay).toHaveBeenCalledTimes(2);
      expect(mockSubmitPlay).toHaveBeenLastCalledWith(GAME_ID, {
         card: "5d",
      });
   }, 10000);

   it("re-enables play after a failed request", async () => {
      mockGetGameState
         .mockResolvedValueOnce({ ok: true, data: makePlayingState() })
         .mockResolvedValue({ ok: true, data: makePlayingState() });

      mockSubmitPlay.mockResolvedValueOnce({
         ok: false,
         error: "Server error",
      });

      const user = await renderAndWaitForPlayableHand();

      await user.click(screen.getByRole("button", { name: "Card 2 of c" }));
      expect(mockSubmitPlay).toHaveBeenCalledTimes(1);

      // Error should display (confirms the promise resolved and guard reset)
      await waitFor(() => {
         expect(screen.getByRole("alert")).toHaveTextContent("Server error");
      });
   }, 10000);
});
