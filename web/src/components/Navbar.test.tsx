import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, afterEach } from "vitest";
import { Navbar } from "./Navbar";
import { renderWithProviders } from "@/test/helpers";
import { STORAGE_KEY } from "@/lib/constants";

const mockFetch = vi.fn();

beforeEach(() => {
   localStorage.clear();
   mockFetch.mockReset();
   vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("Navbar", () => {
   it("renders user button", async () => {
      renderWithProviders(<Navbar />, { route: "/game/create" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Login/User Settings" })
         ).toBeInTheDocument();
      });
   });

   it("shows Guest when not authenticated", async () => {
      renderWithProviders(<Navbar />, { route: "/game/create" });
      await waitFor(() => {
         expect(screen.getByText("Guest")).toBeInTheDocument();
      });
   });

   it("shows username when authenticated", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const header = btoa(JSON.stringify({ alg: "HS256" }));
      const payload = btoa(
         JSON.stringify({ sub: "1", username: "alice", exp: futureExp })
      );
      localStorage.setItem(STORAGE_KEY, `${header}.${payload}.sig`);

      mockFetch.mockResolvedValueOnce({
         ok: true,
         json: () =>
            Promise.resolve({
               user: {
                  id: 1,
                  username: "alice",
                  email: "alice@test.com",
                  preferences: null,
               },
            }),
      });

      renderWithProviders(<Navbar />, { route: "/game/create" });
      await waitFor(() => {
         expect(screen.getByText("alice")).toBeInTheDocument();
      });
   });

   it("renders theme toggle button", async () => {
      renderWithProviders(<Navbar />, { route: "/about" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", {
               name: "Toggle between light and dark mode",
            })
         ).toBeInTheDocument();
      });
   });

   it("renders sound toggle button", async () => {
      renderWithProviders(<Navbar />, { route: "/about" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Toggle sound on or off" })
         ).toBeInTheDocument();
      });
   });

   it("renders HEARTS text when not on home page", async () => {
      renderWithProviders(<Navbar />, { route: "/about" });
      await waitFor(() => {
         expect(screen.getByText("HEARTS")).toBeInTheDocument();
      });
   });
});
