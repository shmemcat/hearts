import { screen, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import PlayPage from "./play";
import { renderWithProviders } from "@/test/helpers";

vi.mock("@/lib/gameApi", () => ({
   checkActiveGame: vi.fn().mockResolvedValue({ ok: true, game_id: null }),
   concedeGame: vi.fn(),
}));

vi.mock("@/lib/lobbyApi", () => ({
   getLobbyState: vi.fn(),
   checkMultiplayerGameActive: vi.fn(),
}));

vi.mock("@/lib/multiplayerSession", () => ({
   findActiveMultiplayerSession: vi.fn().mockReturnValue(null),
   clearMultiplayerSession: vi.fn(),
}));

beforeEach(() => {
   vi.clearAllMocks();
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("PlayPage", () => {
   it("renders Create Game and Join Game choices", async () => {
      renderWithProviders(<PlayPage />, { route: "/play" });
      await waitFor(() => {
         expect(screen.getByText("Create Game")).toBeInTheDocument();
      });
      expect(screen.getByText("Join Game")).toBeInTheDocument();
   });

   it("renders descriptive subtext for each choice", async () => {
      renderWithProviders(<PlayPage />, { route: "/play" });
      await waitFor(() => {
         expect(
            screen.getByText("Start a new game against bots or online")
         ).toBeInTheDocument();
      });
      expect(
         screen.getByText("Enter a lobby code to join a friend")
      ).toBeInTheDocument();
   });

   it("has a Home button", async () => {
      renderWithProviders(<PlayPage />, { route: "/play" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Home" })
         ).toBeInTheDocument();
      });
   });

   it("links Create Game to /game/create", async () => {
      renderWithProviders(<PlayPage />, { route: "/play" });
      await waitFor(() => {
         expect(screen.getByText("Create Game")).toBeInTheDocument();
      });
      const link = screen.getByText("Create Game").closest("a");
      expect(link).toHaveAttribute("href", "/game/create");
   });

   it("links Join Game to /game/join", async () => {
      renderWithProviders(<PlayPage />, { route: "/play" });
      await waitFor(() => {
         expect(screen.getByText("Join Game")).toBeInTheDocument();
      });
      const link = screen.getByText("Join Game").closest("a");
      expect(link).toHaveAttribute("href", "/game/join");
   });
});
