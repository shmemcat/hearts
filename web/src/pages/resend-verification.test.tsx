import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, afterEach } from "vitest";
import ResendVerificationPage from "./resend-verification";
import { renderWithProviders } from "@/test/helpers";

const mockFetch = vi.fn();

beforeEach(() => {
   mockFetch.mockReset();
   vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("ResendVerificationPage", () => {
   it("renders email form", () => {
      renderWithProviders(<ResendVerificationPage />, {
         route: "/resend-verification",
      });
      expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
      expect(
         screen.getByRole("button", { name: "Resend verification" })
      ).toBeInTheDocument();
   });

   it("shows success message after submitting", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
         ok: true,
         json: () => Promise.resolve({ message: "ok" }),
      });
      renderWithProviders(<ResendVerificationPage />, {
         route: "/resend-verification",
      });
      fireEvent.change(screen.getByPlaceholderText("Email"), {
         target: { value: "test@test.com" },
      });
      await user.click(
         screen.getByRole("button", { name: "Resend verification" })
      );
      await waitFor(() => {
         expect(
            screen.getByText(/sent a new verification link/i)
         ).toBeInTheDocument();
      });
   });

   it("shows error on server failure", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
         ok: false,
         json: () => Promise.resolve({ error: "Something went wrong" }),
      });
      renderWithProviders(<ResendVerificationPage />, {
         route: "/resend-verification",
      });
      fireEvent.change(screen.getByPlaceholderText("Email"), {
         target: { value: "bad@example.com" },
      });
      await user.click(
         screen.getByRole("button", { name: "Resend verification" })
      );
      await waitFor(() => {
         expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
   });

   it("has link back to sign in", () => {
      renderWithProviders(<ResendVerificationPage />, {
         route: "/resend-verification",
      });
      expect(screen.getByText("Back to sign in")).toBeInTheDocument();
   });
});
