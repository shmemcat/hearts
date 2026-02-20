import { render, screen, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { LoginWarning } from "./LoginWarning";
import { renderWithProviders } from "@/test/helpers";
import { STORAGE_KEY } from "@/lib/constants";

beforeEach(() => {
   localStorage.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("LoginWarning", () => {
   it("shows warning when user is not signed in", async () => {
      renderWithProviders(<LoginWarning />);
      await waitFor(() => {
         expect(screen.getByText(/not signed in/i)).toBeInTheDocument();
      });
   });

   it("shows sign-in link", async () => {
      renderWithProviders(<LoginWarning />);
      await waitFor(() => {
         expect(screen.getByText(/sign in/i)).toBeInTheDocument();
      });
   });

   it("does not render when user is authenticated", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const header = btoa(JSON.stringify({ alg: "HS256" }));
      const payload = btoa(
         JSON.stringify({ sub: "1", username: "test", exp: futureExp })
      );
      localStorage.setItem(STORAGE_KEY, `${header}.${payload}.sig`);

      renderWithProviders(<LoginWarning />);
      await waitFor(() => {
         expect(screen.queryByText(/not signed in/i)).not.toBeInTheDocument();
      });
   });
});
