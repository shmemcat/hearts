import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, afterEach } from "vitest";
import CreateGamePage from "./create";
import { renderWithProviders } from "@/test/helpers";

const mockFetch = vi.fn();

beforeEach(() => {
   mockFetch.mockReset();
   vi.stubGlobal("fetch", mockFetch);
   mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ game_id: null }),
   });
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("CreateGamePage", () => {
   it("renders page title and game type options", async () => {
      renderWithProviders(<CreateGamePage />, { route: "/game/create" });
      await waitFor(() => {
         expect(screen.getByText("Game Type")).toBeInTheDocument();
      });
      expect(screen.getByLabelText("Versus Bots")).toBeInTheDocument();
      expect(screen.getByLabelText("Online")).toBeInTheDocument();
   });

   it("shows difficulty options by default (Versus Bots)", async () => {
      renderWithProviders(<CreateGamePage />, { route: "/game/create" });
      await waitFor(() => {
         expect(screen.getByText("Bot Difficulty")).toBeInTheDocument();
      });
      expect(screen.getByLabelText("Easy")).toBeInTheDocument();
      expect(screen.getByLabelText("Medium")).toBeInTheDocument();
      expect(screen.getByLabelText("My Mom")).toBeInTheDocument();
   });

   it("has a Create Game button", async () => {
      renderWithProviders(<CreateGamePage />, { route: "/game/create" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Create Game!" })
         ).toBeInTheDocument();
      });
   });

   it("Create Game button is enabled for Versus Bots", async () => {
      renderWithProviders(<CreateGamePage />, { route: "/game/create" });
      await waitFor(() => {
         const btn = screen.getByRole("button", { name: "Create Game!" });
         expect(btn).not.toBeDisabled();
      });
   });

   it("switches to Online mode and shows backfill info", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateGamePage />, { route: "/game/create" });
      await waitFor(() => {
         expect(screen.getByLabelText("Online")).toBeInTheDocument();
      });
      await user.click(screen.getByLabelText("Online"));
      await waitFor(() => {
         expect(
            screen.getByText(/Empty seats are filled by bots/)
         ).toBeInTheDocument();
      });
   });

   it("shows error when game creation fails", async () => {
      mockFetch.mockResolvedValue({
         ok: true,
         json: () => Promise.resolve({ game_id: null }),
      });

      const user = userEvent.setup();
      renderWithProviders(<CreateGamePage />, { route: "/game/create" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Create Game!" })
         ).toBeInTheDocument();
      });

      mockFetch.mockResolvedValueOnce({
         ok: false,
         status: 500,
         json: () => Promise.resolve({ error: "Server error" }),
      });

      await user.click(screen.getByRole("button", { name: "Create Game!" }));
      await waitFor(() => {
         expect(screen.getByRole("alert")).toHaveTextContent("Server error");
      });
   });

   it("has Home button", async () => {
      renderWithProviders(<CreateGamePage />, { route: "/game/create" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Home" })
         ).toBeInTheDocument();
      });
   });
});
