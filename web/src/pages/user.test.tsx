import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, afterEach } from "vitest";
import UserPage from "./user";
import { renderWithProviders } from "@/test/helpers";
import { STORAGE_KEY } from "@/lib/constants";
import { AuthContext, useAuth } from "@/context/AuthContext";
import { ToastProvider, useToast } from "@/context/ToastContext";

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
            screen.getByRole("form", { name: "Sign in" })
         ).toBeInTheDocument();
      });
   });

   it("shows username and password inputs", async () => {
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(
            screen.getByPlaceholderText("Username or email")
         ).toBeInTheDocument();
         expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
      });
   });

   it("validates empty username", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(
            screen.getByPlaceholderText("Username or email")
         ).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: "Sign In" }));
      await waitFor(() => {
         expect(
            screen.getByPlaceholderText("Username or email")
         ).toHaveAttribute("aria-invalid", "true");
      });
   });

   it("validates empty password", async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(
            screen.getByPlaceholderText("Username or email")
         ).toBeInTheDocument();
      });
      await user.type(
         screen.getByPlaceholderText("Username or email"),
         "testuser"
      );
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
         expect(
            screen.getByPlaceholderText("Username or email")
         ).toBeInTheDocument();
      });
      await user.type(
         screen.getByPlaceholderText("Username or email"),
         "testuser"
      );
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

   it("has an always-visible resend verification text link below create account", async () => {
      renderWithProviders(<UserPage />, { route: "/user" });
      const resend = await screen.findByRole("link", {
         name: "Resend verification",
      });
      expect(resend).toHaveAttribute("href", "/resend-verification");
      expect(
         screen
            .getByRole("link", { name: "Create an account" })
            .compareDocumentPosition(resend) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
         screen.getByRole("textbox", { name: "Username or email" })
      ).toHaveAttribute("autocomplete", "username");
   });

   it("submits an email address from the sign-in field", async () => {
      const user = userEvent.setup();
      const password = crypto.randomUUID();
      mockFetch.mockResolvedValueOnce({
         ok: false,
         status: 401,
         json: async () => ({ error: "Invalid credentials" }),
      });
      renderWithProviders(<UserPage />, { route: "/user" });
      await user.type(
         await screen.findByPlaceholderText("Username or email"),
         "  EMILY@example.test  "
      );
      await user.type(screen.getByPlaceholderText("Password"), password);
      await user.click(screen.getByRole("button", { name: "Sign In" }));
      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
         username: "EMILY@example.test",
         password,
      });
   });

   it("keeps the resend verification link available after an unverified email error", async () => {
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
         expect(
            screen.getByPlaceholderText("Username or email")
         ).toBeInTheDocument();
      });
      await user.type(
         screen.getByPlaceholderText("Username or email"),
         "testuser"
      );
      await user.type(screen.getByPlaceholderText("Password"), "pass1234");
      await user.click(screen.getByRole("button", { name: "Sign In" }));
      await waitFor(() => {
         expect(
            screen.getByRole("link", { name: "Resend verification" })
         ).toBeInTheDocument();
      });
   });

   it("keeps the resend verification link available after a regular login error", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
         ok: false,
         status: 401,
         json: () => Promise.resolve({ error: "Invalid credentials" }),
      });
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(
            screen.getByPlaceholderText("Username or email")
         ).toBeInTheDocument();
      });
      await user.type(
         screen.getByPlaceholderText("Username or email"),
         "testuser"
      );
      await user.type(screen.getByPlaceholderText("Password"), "wrongpass");
      await user.click(screen.getByRole("button", { name: "Sign In" }));
      await waitFor(() => {
         expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
      expect(
         screen.getByRole("link", { name: "Resend verification" })
      ).toBeInTheDocument();
   });
});

describe("UserPage - Authenticated", () => {
   it("does not copy the previous account's achievements while the next profile is loading", async () => {
      mockFetch.mockImplementation(async (url: string) => ({
         ok: true,
         json: async () =>
            url.endsWith("/stats")
               ? {
                    stats: {
                       games_played: 10,
                       games_won: 3,
                       moon_shots: 1,
                       best_score: 12,
                       worst_score: 85,
                       average_score: 45,
                    },
                 }
               : {},
      }));
      const dashboard = (id: string) => (
         <AuthContext.Provider
            value={{
               user: { id, email: `${id}@test.com` },
               token: `${id}-token`,
               preferences: null,
               status: "authenticated",
               login: vi.fn(),
               logout: vi.fn(),
               updateUser: vi.fn(),
            }}
         >
            <ToastProvider>
               <UserPage />
            </ToastProvider>
         </AuthContext.Provider>
      );
      const view = renderWithProviders(dashboard("alice"), { route: "/user" });
      await screen.findByText("Achievements");
      expect(
         JSON.parse(localStorage.getItem("hearts_seen_achievements_alice")!)
      ).toContain("newcomer_bronze");
      mockFetch.mockImplementation(() => new Promise(() => {}));
      view.rerender(dashboard("bob"));
      expect(localStorage.getItem("hearts_seen_achievements_bob")).toBeNull();
      expect(screen.queryByText("Achievements")).not.toBeInTheDocument();
      expect(
         screen.queryByText("Achievement Unlocked!")
      ).not.toBeInTheDocument();
   });

   it("does not repeat a game achievement when opening the profile afterwards", async () => {
      function GameAward() {
         const { user } = useAuth();
         const { addToast } = useToast();
         return (
            <button
               disabled={!user}
               onClick={() =>
                  addToast({
                     achievementId: "newcomer_bronze",
                     name: "Newcomer",
                     icon: "cards",
                     tier: "bronze",
                  })
               }
            >
               Finish game
            </button>
         );
      }
      setAuthToken();
      localStorage.setItem("hearts_seen_achievements_1", "[]");
      const user = userEvent.setup();
      const view = renderWithProviders(<GameAward />, { route: "/user" });
      await waitFor(() =>
         expect(
            screen.getByRole("button", { name: "Finish game" })
         ).toBeEnabled()
      );
      await user.click(screen.getByRole("button", { name: "Finish game" }));
      await user.click(
         screen.getByRole("button", {
            name: "Dismiss Newcomer achievement notification",
         })
      );
      await waitFor(() =>
         expect(
            screen.queryByText("Achievement Unlocked!")
         ).not.toBeInTheDocument()
      );
      view.rerender(<UserPage />);
      await screen.findByText("Achievements");
      expect(
         screen.queryByText("Achievement Unlocked!")
      ).not.toBeInTheDocument();
      expect(
         JSON.parse(localStorage.getItem("hearts_seen_achievements_1")!)
      ).toContain("newcomer_bronze");
   });

   it("can open the achievement profile when achievement storage is blocked", async () => {
      setAuthToken();
      const getItem = localStorage.getItem.bind(localStorage);
      const setItem = localStorage.setItem.bind(localStorage);
      vi.spyOn(localStorage, "getItem").mockImplementation((key) => {
         if (key.startsWith("hearts_seen_achievements_"))
            throw new Error("blocked");
         return getItem(key);
      });
      vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
         if (key.startsWith("hearts_seen_achievements_"))
            throw new Error("blocked");
         setItem(key, value);
      });
      renderWithProviders(<UserPage />, { route: "/user" });
      expect(await screen.findByText("Achievements")).toBeInTheDocument();
      expect(
         screen.queryByText("Achievement Unlocked!")
      ).not.toBeInTheDocument();
   });

   it.each(['"invalid history"', '{"night_owl":true}', "null"])(
      "quietly seeds malformed achievement history (%s)",
      async (history) => {
         setAuthToken();
         localStorage.setItem("hearts_seen_achievements_1", history);
         renderWithProviders(<UserPage />, { route: "/user" });
         await screen.findByText("Achievements");
         expect(
            screen.queryByText("Achievement Unlocked!")
         ).not.toBeInTheDocument();
         expect(
            JSON.parse(localStorage.getItem("hearts_seen_achievements_1")!)
         ).toContain("newcomer_bronze");
      }
   );

   it("keeps higher achievement tiers seen when current stats show a lower tier", async () => {
      setAuthToken();
      localStorage.setItem(
         "hearts_seen_achievements_1",
         JSON.stringify(["newcomer_gold", "consistent_gold", "night_owl"])
      );
      renderWithProviders(<UserPage />, { route: "/user" });
      await screen.findByText("Achievements");
      expect(
         screen.queryByText("Achievement Unlocked!")
      ).not.toBeInTheDocument();
      const seen = JSON.parse(
         localStorage.getItem("hearts_seen_achievements_1")!
      );
      expect(seen).toContain("newcomer_gold");
      expect(seen).toContain("consistent_gold");
      expect(seen).toContain("night_owl");
   });

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
         })
         .mockResolvedValueOnce({
            ok: true,
            json: () =>
               Promise.resolve({
                  my_mom: {
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

   it("shows pending cleanup after legacy account deletion signs out", async () => {
      setAuthToken();
      const user = userEvent.setup();
      renderWithProviders(<UserPage />, { route: "/user" });
      await screen.findByRole("button", { name: "Delete Account" });
      const message =
         "Account deletion is processing. Cleanup will retry automatically.";
      mockFetch.mockResolvedValue({
         ok: true,
         status: 202,
         json: async () => ({ message }),
      });
      await user.click(screen.getByRole("button", { name: "Delete Account" }));
      await user.click(screen.getByRole("button", { name: "Yes" }));
      await user.type(screen.getByPlaceholderText("Password"), "test-password");
      await user.click(
         screen.getByRole("button", { name: "Delete", exact: true })
      );
      expect(await screen.findByRole("status")).toHaveTextContent(message);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
   });

   it("displays stats when available", async () => {
      setAuthToken();
      renderWithProviders(<UserPage />, { route: "/user" });
      await waitFor(() => {
         expect(screen.getByText("All Time")).toBeInTheDocument();
      });
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("30%")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
   });
});
