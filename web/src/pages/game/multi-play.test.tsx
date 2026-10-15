import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { vi } from "vitest";
import MultiPlayPage from "./multi-play";
import type { GameState, PlayEvent } from "@/types/game";
import type { GameStartedEvent } from "@/types/lobby";
import { createMockGameState } from "@/test/helpers";
import {
   ROUND_BANNER_MS,
   DEAL_HAND_MS,
   CARD_DELAY_MS,
   HOLD_MS,
   COLLECT_MS,
   BADGE_LINGER_MS,
   CLEAR_MS,
   NO_PASS_HOLD_MS,
} from "@/lib/constants";

const mocks = vi.hoisted(() => ({
   state: null as ((data: GameState) => void) | null,
   play: null as ((data: PlayEvent) => void) | null,
   trick: null as (() => void) | null,
   again: null as ((data: GameStartedEvent) => void) | null,
   sound: vi.fn(),
   connect: vi.fn(),
}));

vi.mock("@/lib/multiplayerSocket", () => ({
   connectMulti: mocks.connect,
   disconnect: vi.fn(),
   sendPlay: vi.fn(),
   sendPass: vi.fn(),
   sendConcede: vi.fn(),
   sendRequestState: vi.fn(),
   onState: (cb: typeof mocks.state) => {
      mocks.state = cb;
      return vi.fn();
   },
   onPlay: (cb: typeof mocks.play) => {
      mocks.play = cb;
      return vi.fn();
   },
   onTrickComplete: (cb: typeof mocks.trick) => {
      mocks.trick = cb;
      return vi.fn();
   },
   onPlayAgainStarted: (cb: typeof mocks.again) => {
      mocks.again = cb;
      return vi.fn();
   },
   onPassReceived: vi.fn(() => vi.fn()),
   onPlayerConceded: vi.fn(() => vi.fn()),
   onIdleWarning: vi.fn(() => vi.fn()),
   onGameTerminated: vi.fn(() => vi.fn()),
   onGameOver: vi.fn(() => vi.fn()),
   onError: vi.fn(() => vi.fn()),
   onAchievementsUnlocked: vi.fn(() => vi.fn()),
}));
vi.mock("@/context/AuthContext", () => ({
   useAuth: () => ({ token: null, user: null }),
}));
vi.mock("@/context/SoundContext", () => ({
   useSound: () => ({ play: mocks.sound }),
}));
vi.mock("@/context/ToastContext", () => ({
   useToast: () => ({ addToast: vi.fn() }),
}));
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/Navbar", () => ({ triggerLogoFadeOut: vi.fn() }));
vi.mock("@/components/ui", () => ({
   PageLayout: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   ButtonGroup: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
}));
vi.mock("@/components/game", async (importOriginal) => ({
   ...(await importOriginal<typeof import("@/components/game")>()),
   Hand: ({
      cards,
      onCardClick,
   }: {
      cards: string[];
      onCardClick?: (card: string) => void;
   }) => (
      <div data-testid="hand">
         {cards.map((card) => (
            <button key={card} onClick={() => onCardClick?.(card)}>
               {card}
            </button>
         ))}
      </div>
   ),
   GameSeat: ({
      seatIndex,
      heartCount,
   }: {
      seatIndex: number;
      heartCount: number;
   }) => <div data-testid={`seat-${seatIndex}`}>{heartCount}</div>,
   Trick: () => <div />,
}));

function tick(ms: number) {
   act(() => {
      vi.advanceTimersByTime(ms);
   });
}
function emitState(overrides: Partial<GameState> = {}) {
   act(() =>
      mocks.state?.(
         createMockGameState({ my_seat: 1, whose_turn: 1, ...overrides })
      )
   );
}
function start(overrides: Partial<GameState> = {}) {
   render(
      <HelmetProvider>
         <MemoryRouter initialEntries={["/game/multi-play?game_id=first"]}>
            <MultiPlayPage />
         </MemoryRouter>
      </HelmetProvider>
   );
   emitState(overrides);
   tick(ROUND_BANNER_MS);
   tick(DEAL_HAND_MS);
}
function playTrick() {
   act(() => {
      for (const event of [
         { player_index: 2, card: "Ac" },
         { player_index: 3, card: "Qs" },
         { player_index: 0, card: "2h" },
         { player_index: 1, card: "3h" },
      ])
         mocks.play?.(event);
      mocks.trick?.();
   });
   for (let i = 0; i < 4; i++) tick(CARD_DELAY_MS);
   tick(HOLD_MS);
}

beforeEach(() => {
   vi.useFakeTimers();
   vi.clearAllMocks();
   localStorage.setItem("hearts_mp_token_first", "player-token");
   localStorage.setItem("hearts_mp_seat_first", "1");
   localStorage.setItem("hearts_mp_lobby_first", "ABCDEF");
});
afterEach(() => {
   vi.useRealTimers();
});

it("starts a rematch with fresh counts, credentials and seat", () => {
   start();
   playTrick();
   expect(screen.getByTestId("seat-2")).toHaveTextContent("15");
   act(() =>
      mocks.again?.({
         game_id: "second",
         difficulty: "easy",
         seats: [],
         seat_assignments: [{ player_token: "player-token", seat_index: 3 }],
      })
   );
   expect(mocks.connect).toHaveBeenLastCalledWith(
      "second",
      "player-token",
      null
   );
   emitState({ my_seat: 3, whose_turn: 3 });
   tick(ROUND_BANNER_MS);
   tick(DEAL_HAND_MS);
   expect(screen.getByTestId("seat-2")).toHaveTextContent("0");
   expect(screen.getByText("Your turn!")).toBeVisible();
   playTrick();
   expect(screen.getByTestId("seat-2")).toHaveTextContent("15");
});

it("gives the player 15 seconds after dealing before reminding them", () => {
   start({ phase: "passing", legal_plays: [] });
   mocks.sound.mockClear();
   tick(14_999);
   expect(mocks.sound).not.toHaveBeenCalledWith("notification");
   tick(1);
   expect(mocks.sound).toHaveBeenCalledWith("notification");
});

it("starts the reminder after the no-pass announcement ends", () => {
   start({ pass_direction: "none" });
   mocks.sound.mockClear();
   tick(NO_PASS_HOLD_MS - DEAL_HAND_MS);
   tick(14_999);
   expect(mocks.sound).not.toHaveBeenCalledWith("notification");
   tick(1);
   expect(mocks.sound).toHaveBeenCalledWith("notification");
});

it("does not remind while waiting for other players to pass", () => {
   start({ phase: "passing", legal_plays: [] });
   fireEvent.click(screen.getByText("2c"));
   fireEvent.click(screen.getByText("5d"));
   fireEvent.click(screen.getByText("Js"));
   fireEvent.click(screen.getByRole("button", { name: /submit pass/i }));
   mocks.sound.mockClear();
   tick(20_000);
   expect(mocks.sound).not.toHaveBeenCalledWith("notification");
});

it("does not remind while the round summary is open", () => {
   start();
   emitState({
      round: 2,
      round_just_ended: true,
      phase: "passing",
      legal_plays: [],
   });
   tick(BADGE_LINGER_MS);
   mocks.sound.mockClear();
   tick(20_000);
   expect(mocks.sound).not.toHaveBeenCalledWith("notification");
});

it("keeps Round over visible after the final trick clears", () => {
   start({ my_hand: [], human_hand: [], legal_plays: [] });
   playTrick();
   expect(screen.getByText("Round over")).toBeVisible();
   tick(COLLECT_MS);
   expect(screen.queryByText("Your turn!")).not.toBeInTheDocument();
   expect(screen.getByText("Round over")).toBeVisible();
   tick(BADGE_LINGER_MS);
   tick(CLEAR_MS);
   expect(screen.getByText("Round over")).toBeVisible();
});

it("does not fall back to Your turn while the next trick is being prepared", () => {
   start();
   playTrick();
   tick(COLLECT_MS);
   expect(screen.queryByText("Your turn!")).not.toBeInTheDocument();
   tick(BADGE_LINGER_MS);
   expect(screen.queryByText("Your turn!")).not.toBeInTheDocument();
});

it("applies the completed pass before the initial banner reveals the hand", () => {
   render(
      <HelmetProvider>
         <MemoryRouter initialEntries={["/game/multi-play?game_id=first"]}>
            <MultiPlayPage />
         </MemoryRouter>
      </HelmetProvider>
   );
   emitState({
      phase: "passing",
      pass_submitted: true,
      my_hand: ["2c", "5d", "Js"],
      legal_plays: [],
   });
   emitState({ my_hand: ["3d", "4d", "6d"] });
   tick(ROUND_BANNER_MS);
   tick(DEAL_HAND_MS);
   expect(screen.getByTestId("hand")).toHaveTextContent("3d4d6d");
   expect(screen.queryByText("2c")).not.toBeInTheDocument();
});
