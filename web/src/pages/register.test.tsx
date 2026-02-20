import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, afterEach } from "vitest";
import RegisterPage from "./register";
import { renderWithProviders } from "@/test/helpers";

const mockFetch = vi.fn();

beforeEach(() => {
   mockFetch.mockReset();
   vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
   vi.restoreAllMocks();
});

function fillInput(placeholder: string, value: string) {
   fireEvent.change(screen.getByPlaceholderText(placeholder), {
      target: { value },
   });
}

describe("RegisterPage", () => {
   it("renders registration form", () => {
      renderWithProviders(<RegisterPage />, { route: "/register" });
      expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
      expect(
         screen.getByPlaceholderText("Confirm password")
      ).toBeInTheDocument();
   });

   it("shows error for empty username", async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: "/register" });
      await user.click(screen.getByRole("button", { name: "Create account" }));
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Username")).toHaveAttribute(
            "aria-invalid",
            "true"
         );
      });
   });

   it("shows error for invalid username format", async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: "/register" });
      await user.type(screen.getByPlaceholderText("Username"), "ab");
      await user.click(screen.getByRole("button", { name: "Create account" }));
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Username")).toHaveAttribute(
            "aria-invalid",
            "true"
         );
      });
   });

   it("shows error for short password", async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: "/register" });
      fillInput("Username", "validuser");
      fillInput("Email", "test@test.com");
      fillInput("Password", "short");
      await user.click(screen.getByRole("button", { name: "Create account" }));
      await waitFor(() => {
         expect(screen.getByPlaceholderText("Password")).toHaveAttribute(
            "aria-invalid",
            "true"
         );
      });
   });

   it("shows error when passwords don't match", async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterPage />, { route: "/register" });
      fillInput("Username", "validuser");
      fillInput("Email", "test@test.com");
      fillInput("Password", "password123");
      fillInput("Confirm password", "different123");
      await user.click(screen.getByRole("button", { name: "Create account" }));
      await waitFor(() => {
         expect(
            screen.getByPlaceholderText("Confirm password")
         ).toHaveAttribute("aria-invalid", "true");
      });
   });

   it("shows success message on successful registration", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
         ok: true,
         json: () => Promise.resolve({ message: "ok" }),
      });
      renderWithProviders(<RegisterPage />, { route: "/register" });
      fillInput("Username", "validuser");
      fillInput("Email", "test@test.com");
      fillInput("Password", "password123");
      fillInput("Confirm password", "password123");
      await user.click(screen.getByRole("button", { name: "Create account" }));
      await waitFor(() => {
         expect(screen.getByText(/Account created!/)).toBeInTheDocument();
         expect(screen.getByText(/verify your account/i)).toBeInTheDocument();
      });
   });

   it("shows server error on failed registration", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
         ok: false,
         json: () => Promise.resolve({ error: "Username taken" }),
      });
      renderWithProviders(<RegisterPage />, { route: "/register" });
      fillInput("Username", "validuser");
      fillInput("Email", "test@test.com");
      fillInput("Password", "password123");
      fillInput("Confirm password", "password123");
      await user.click(screen.getByRole("button", { name: "Create account" }));
      await waitFor(() => {
         expect(screen.getByText("Username taken")).toBeInTheDocument();
      });
   });

   it("has link to sign in page", () => {
      renderWithProviders(<RegisterPage />, { route: "/register" });
      expect(screen.getByText(/Already have an account/)).toBeInTheDocument();
   });
});
