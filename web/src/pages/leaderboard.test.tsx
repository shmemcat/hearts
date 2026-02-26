import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, afterEach } from "vitest";
import LeaderboardPage from "./leaderboard";
import { renderWithProviders } from "@/test/helpers";

const mockFetchLeaderboard = vi.fn();

vi.mock("@/lib/gameApi", () => ({
   fetchLeaderboard: (...args: unknown[]) => mockFetchLeaderboard(...args),
}));

vi.mock("@/lib/profileIcons", () => ({
   getProfileIcon: () => ({ prefix: "fas", iconName: "cat" }),
}));

const EMPTY_RESPONSE = {
   ok: true as const,
   data: { monthly: [], all_time: [] },
};

const POPULATED_RESPONSE = {
   ok: true as const,
   data: {
      monthly: [
         { rank: 1, username: "alice", profile_icon: "cat", games_won: 10 },
         { rank: 2, username: "bob", profile_icon: "dog", games_won: 7 },
      ],
      all_time: [
         { rank: 1, username: "charlie", profile_icon: "cat", games_won: 50 },
         { rank: 2, username: "dana", profile_icon: "cat", games_won: 42 },
         { rank: 3, username: "eve", profile_icon: "dog", games_won: 31 },
      ],
   },
};

beforeEach(() => {
   mockFetchLeaderboard.mockReset();
   mockFetchLeaderboard.mockResolvedValue(EMPTY_RESPONSE);
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("LeaderboardPage", () => {
   it("renders top-level tabs", async () => {
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(screen.getByText("Easy")).toBeInTheDocument();
      });
      expect(screen.getByText("Medium")).toBeInTheDocument();
      expect(screen.getByText("My Mom")).toBeInTheDocument();
   });

   it("fetches easy leaderboard on initial render", async () => {
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(mockFetchLeaderboard).toHaveBeenCalledWith("easy");
      });
   });

   it("shows Monthly and All-Time column titles", async () => {
      mockFetchLeaderboard.mockResolvedValue(POPULATED_RESPONSE);
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(screen.getByText("Monthly")).toBeInTheDocument();
      });
      expect(screen.getByText("All-Time")).toBeInTheDocument();
   });

   it("displays leaderboard entries with usernames and wins", async () => {
      mockFetchLeaderboard.mockResolvedValue(POPULATED_RESPONSE);
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(screen.getByText("alice")).toBeInTheDocument();
      });
      expect(screen.getByText("charlie")).toBeInTheDocument();
      expect(screen.getByText("dana")).toBeInTheDocument();
      expect(screen.getByText("50 wins")).toBeInTheDocument();
      expect(screen.getByText("10 wins")).toBeInTheDocument();
   });

   it("shows 'No winners yet' when lists are empty", async () => {
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(mockFetchLeaderboard).toHaveBeenCalled();
      });
      const empties = screen.getAllByText("No winners yet");
      expect(empties).toHaveLength(2);
   });

   it("fetches new data when switching tabs", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(mockFetchLeaderboard).toHaveBeenCalledWith("easy");
      });

      await user.click(screen.getByText("Medium"));
      await waitFor(() => {
         expect(mockFetchLeaderboard).toHaveBeenCalledWith("medium");
      });
   });

   it("shows My Mom sub-tabs when My Mom is selected", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(screen.getByText("My Mom")).toBeInTheDocument();
      });

      await user.click(screen.getByText("My Mom"));
      await waitFor(() => {
         expect(screen.getByText("Hard")).toBeInTheDocument();
      });
      expect(screen.getByText("Harder")).toBeInTheDocument();
      expect(screen.getByText("Hardest")).toBeInTheDocument();
   });

   it("fetches 'hard' category when My Mom → Hard is selected", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(screen.getByText("My Mom")).toBeInTheDocument();
      });

      await user.click(screen.getByText("My Mom"));
      await waitFor(() => {
         expect(mockFetchLeaderboard).toHaveBeenCalledWith("hard");
      });
   });

   it("fetches 'harder' when switching My Mom sub-tab", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(screen.getByText("My Mom")).toBeInTheDocument();
      });

      await user.click(screen.getByText("My Mom"));
      await waitFor(() => {
         expect(screen.getByText("Harder")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Harder"));
      await waitFor(() => {
         expect(mockFetchLeaderboard).toHaveBeenCalledWith("harder");
      });
   });

   it("singular 'win' for a single win", async () => {
      mockFetchLeaderboard.mockResolvedValue({
         ok: true,
         data: {
            monthly: [
               {
                  rank: 1,
                  username: "solowin",
                  profile_icon: "cat",
                  games_won: 1,
               },
            ],
            all_time: [],
         },
      });
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(screen.getByText("1 win")).toBeInTheDocument();
      });
   });

   it("has a Home button", async () => {
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Home" })
         ).toBeInTheDocument();
      });
   });

   it("fetches multiplayer when switching to Multiplayer tab", async () => {
      const user = userEvent.setup();
      renderWithProviders(<LeaderboardPage />, { route: "/leaderboard" });
      await waitFor(() => {
         expect(mockFetchLeaderboard).toHaveBeenCalledWith("easy");
      });

      const multiTab = screen.getByText("Multiplayer");
      await user.click(multiTab);
      await waitFor(() => {
         expect(mockFetchLeaderboard).toHaveBeenCalledWith("multiplayer");
      });
   });
});
