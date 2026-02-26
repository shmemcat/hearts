import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, afterEach } from "vitest";
import { useActiveGameModals } from "./useActiveGameModals";
import { renderWithProviders } from "@/test/helpers";

vi.mock("@/context/AuthContext", () => ({
   useAuth: () => ({ token: "test-token", user: null }),
   AuthProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
   ),
}));

const mockCheckActiveGame = vi.fn();
const mockConcedeGame = vi.fn();
vi.mock("@/lib/gameApi", () => ({
   checkActiveGame: (...args: unknown[]) => mockCheckActiveGame(...args),
   concedeGame: (...args: unknown[]) => mockConcedeGame(...args),
}));

const mockGetLobbyState = vi.fn();
const mockCheckMultiplayerGameActive = vi.fn();
vi.mock("@/lib/lobbyApi", () => ({
   getLobbyState: (...args: unknown[]) => mockGetLobbyState(...args),
   checkMultiplayerGameActive: (...args: unknown[]) =>
      mockCheckMultiplayerGameActive(...args),
}));

const mockFindSession = vi.fn();
const mockClearSession = vi.fn();
vi.mock("@/lib/multiplayerSession", () => ({
   findActiveMultiplayerSession: () => mockFindSession(),
   clearMultiplayerSession: (...args: unknown[]) => mockClearSession(...args),
}));

function TestHarness() {
   const modals = useActiveGameModals();
   return <div>{modals}</div>;
}

beforeEach(() => {
   mockCheckActiveGame.mockReset();
   mockConcedeGame.mockReset();
   mockGetLobbyState.mockReset();
   mockCheckMultiplayerGameActive.mockReset();
   mockFindSession.mockReset();
   mockClearSession.mockReset();

   mockCheckActiveGame.mockResolvedValue({ ok: true, game_id: null });
   mockFindSession.mockReturnValue(null);
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("useActiveGameModals", () => {
   it("renders nothing when no active games or sessions exist", async () => {
      const { container } = renderWithProviders(<TestHarness />, {
         route: "/play",
      });
      await waitFor(() => {
         expect(mockCheckActiveGame).toHaveBeenCalled();
      });
      expect(container.querySelector("[class*='backdrop']")).toBeNull();
   });

   it("shows single-player modal when active game exists", async () => {
      mockCheckActiveGame.mockResolvedValue({
         ok: true,
         game_id: "game-abc",
      });

      renderWithProviders(<TestHarness />, { route: "/play" });

      await waitFor(() => {
         expect(screen.getByText("Game In Progress")).toBeInTheDocument();
      });
      expect(
         screen.getByText(
            "You have a game active. Do you wish to continue playing?"
         )
      ).toBeInTheDocument();
      expect(
         screen.getByRole("button", { name: "Continue" })
      ).toBeInTheDocument();
      expect(
         screen.getByRole("button", { name: "Concede" })
      ).toBeInTheDocument();
   });

   it("concede flow: shows confirmation then concedes", async () => {
      mockCheckActiveGame.mockResolvedValue({
         ok: true,
         game_id: "game-abc",
      });
      mockConcedeGame.mockResolvedValue({
         ok: true,
         newly_unlocked: [],
      });

      const user = userEvent.setup();
      renderWithProviders(<TestHarness />, { route: "/play" });

      await waitFor(() => {
         expect(screen.getByText("Game In Progress")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Concede" }));

      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      expect(
         screen.getByText("Are you sure you wish to concede?")
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Yes" }));

      await waitFor(() => {
         expect(mockConcedeGame).toHaveBeenCalledWith("game-abc", "test-token");
      });
   });

   it("shows lobby modal when an active lobby session exists", async () => {
      mockFindSession.mockReturnValue({ type: "lobby", code: "ABCD" });
      mockGetLobbyState.mockResolvedValue({
         ok: true,
         data: { status: "waiting" },
      });

      renderWithProviders(<TestHarness />, { route: "/play" });

      await waitFor(() => {
         expect(screen.getByText("Lobby In Progress")).toBeInTheDocument();
      });
      expect(
         screen.getByText("You have an active lobby. Rejoin?")
      ).toBeInTheDocument();
      expect(
         screen.getByRole("button", { name: "Rejoin" })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
   });

   it("shows multiplayer game modal when an active mp game exists", async () => {
      mockFindSession.mockReturnValue({ type: "game", gameId: "mp-123" });
      mockCheckMultiplayerGameActive.mockResolvedValue(true);

      renderWithProviders(<TestHarness />, { route: "/play" });

      await waitFor(() => {
         expect(
            screen.getByText("You have a multiplayer game in progress. Rejoin?")
         ).toBeInTheDocument();
      });
   });

   it("clears stale lobby session", async () => {
      mockFindSession.mockReturnValue({ type: "lobby", code: "STALE" });
      mockGetLobbyState.mockResolvedValue({
         ok: true,
         data: { status: "finished" },
      });

      renderWithProviders(<TestHarness />, { route: "/play" });

      await waitFor(() => {
         expect(mockClearSession).toHaveBeenCalledWith({
            type: "lobby",
            code: "STALE",
         });
      });
   });

   it("clears stale multiplayer game session", async () => {
      mockFindSession.mockReturnValue({ type: "game", gameId: "old-game" });
      mockCheckMultiplayerGameActive.mockResolvedValue(false);

      renderWithProviders(<TestHarness />, { route: "/play" });

      await waitFor(() => {
         expect(mockClearSession).toHaveBeenCalledWith({
            type: "game",
            gameId: "old-game",
         });
      });
   });

   it("single-player modal takes priority over multiplayer modal", async () => {
      mockCheckActiveGame.mockResolvedValue({
         ok: true,
         game_id: "game-abc",
      });
      mockFindSession.mockReturnValue({ type: "lobby", code: "ABCD" });
      mockGetLobbyState.mockResolvedValue({
         ok: true,
         data: { status: "waiting" },
      });

      renderWithProviders(<TestHarness />, { route: "/play" });

      await waitFor(() => {
         expect(screen.getByText("Game In Progress")).toBeInTheDocument();
      });
      expect(screen.queryByText("Lobby In Progress")).not.toBeInTheDocument();
   });

   it("leave flow: clears multiplayer session", async () => {
      mockFindSession.mockReturnValue({ type: "lobby", code: "ABCD" });
      mockGetLobbyState.mockResolvedValue({
         ok: true,
         data: { status: "waiting" },
      });

      const user = userEvent.setup();
      renderWithProviders(<TestHarness />, { route: "/play" });

      await waitFor(() => {
         expect(screen.getByText("Lobby In Progress")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Leave" }));
      await user.click(screen.getByRole("button", { name: "Yes" }));

      await waitFor(() => {
         expect(mockClearSession).toHaveBeenCalledWith({
            type: "lobby",
            code: "ABCD",
         });
      });
   });
});
