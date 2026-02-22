import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, afterEach } from "vitest";
import UserPage from "./user";
import { renderWithProviders } from "@/test/helpers";
import { STORAGE_KEY } from "@/lib/constants";

const mockFetch = vi.fn();

function makeJwt(payload: Record<string, unknown>): string {
   const header = btoa(JSON.stringify({ alg: "HS256" }));
   const body = btoa(JSON.stringify(payload));
   return `${header}.${body}.sig`;
}

beforeEach(() => {
   mockFetch.mockReset();
   vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("UserPage - Guest", () => {
   it("shows sign in form when not authenticated", async () => {
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(
            screen.getByText("Sign in with your username and password.")
         ).toBeInTheDocument();
      });
   });

   it("shows username and password inputs", async () => {
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
         expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
      });
   });

   it("validates empty username", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: "Sign In" }));
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Username")).toHaveAttribute(
            "aria-invalid",
            "true"
         );
      });
   });

   it("validates empty password", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
      });
      await user.type(screen.getByPlaceholderText("Username"), "testuser");
      await user.click(screen.getByRole("button", { name: "Sign In" }));
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Password")).toHaveAttribute(
            "aria-invalid",
            "true"
         );
      });
   });

   it("shows error on failed login", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
         ok: false,
         status: 401,
         json: () => Promise.resolve({ error: "Invalid credentials" }),
      });
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
      });
      await user.type(screen.getByPlaceholderText("Username"), "testuser");
      await user.type(screen.getByPlaceholderText("Password"), "wrongpass");
      await user.click(screen.getByRole("button", { name: "Sign In" }));
      await waitFor(() => {
         expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
   });

   it("has link to create account", async () => {
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByText("Create an account")).toBeInTheDocument();
      });
   });

   it("has link to forgot password", async () => {
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByText("Forgot password?")).toBeInTheDocument();
      });
   });

   it("shows resend verification link on unverified email error", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
         ok: false,
         status: 403,
         json: () =>
            Promise.resolve({
               error: "Check your email to verify your account before signing in.",
               code: "EMAIL_NOT_VERIFIED",
            }),
      });
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
      });
      await user.type(screen.getByPlaceholderText("Username"), "testuser");
      await user.type(screen.getByPlaceholderText("Password"), "pass1234");
      await user.click(screen.getByRole("button", { name: "Sign In" }));
      await waitFor(() => {
         expect(
            screen.getByText("Resend verification email")
         ).toBeInTheDocument();
      });
   });

   it("does not show resend link on regular login error", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
         ok: false,
         status: 401,
         json: () => Promise.resolve({ error: "Invalid credentials" }),
      });
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
      });
      await user.type(screen.getByPlaceholderText("Username"), "testuser");
      await user.type(screen.getByPlaceholderText("Password"), "wrongpass");
      await user.click(screen.getByRole("button", { name: "Sign In" }));
      await waitFor(() => {
         expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
      expect(
         screen.queryByText("Resend verification email")
      ).not.toBeInTheDocument();
   });
});

describe("UserPage - Authenticated", () => {
   function setAuthToken() {
      const token = makeJwt({
         sub: "1",
         username: "alice",
         email: "a@test.com",
         exp: Math.floor(Date.now() / 1000) + 3600,
      });
      localStorage.setItem(STORAGE_KEY, token);
      mockFetch
         .mockResolvedValueOnce({
            ok: true,
            json: () =>
               Promise.resolve({
                  user: {
                     id: 1,
                     username: "alice",
                     email: "a@test.com",
                     preferences: null,
                  },
               }),
         })
         .mockResolvedValueOnce({
            ok: true,
            json: () =>
               Promise.resolve({
                  stats: {
                     games_played: 10,
                     games_won: 3,
                     moon_shots: 1,
                     best_score: 12,
                     worst_score: 85,
                     average_score: 45,
                  },
               }),
         });
   }

   it("shows welcome message when authenticated", async () => {
      setAuthToken();
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByText(/Welcome/)).toBeInTheDocument();
      });
      expect(screen.getAllByText("alice").length).toBeGreaterThanOrEqual(1);
   });

   it("shows Sign Out button when authenticated", async () => {
      setAuthToken();
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Sign Out" })
         ).toBeInTheDocument();
      });
   });

   it("shows Delete Account button when authenticated", async () => {
      setAuthToken();
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Delete Account" })
         ).toBeInTheDocument();
      });
   });

   it("opens delete modal on Delete Account click", async () => {
      const user = userEvent.setup();
      setAuthToken();
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(
            screen.getByRole("button", { name: "Delete Account" })
         ).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: "Delete Account" }));
      await waitFor(() => {
         expect(
            screen.getByText(/delete all your user data/i)
         ).toBeInTheDocument();
      });
   });

   it("displays stats when available", async () => {
      setAuthToken();
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByText("Your Stats")).toBeInTheDocument();
      });
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("30%")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
   });
});
