import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { STORAGE_KEY } from "@/lib/constants";

const mockFetch = vi.fn();

function makeJwt(payload: Record<string, unknown>): string {
   const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
   const body = btoa(JSON.stringify(payload));
   return `${header}.${body}.fakesig`;
}

beforeEach(() => {
   vi.stubGlobal("fetch", mockFetch);
   localStorage.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});

function wrapper({ children }: { children: React.ReactNode }) {
   return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext", () => {
   it("starts unauthenticated when no token in localStorage", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => {
         expect(result.current.status).toBe("unauthenticated");
      });
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
   });

   it("restores user from valid localStorage token", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const token = makeJwt({
         sub: "42",
         username: "alice",
         email: "alice@test.com",
         exp: futureExp,
      });
      localStorage.setItem(STORAGE_KEY, token);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => {
         expect(result.current.status).toBe("authenticated");
      });
      expect(result.current.user).toEqual({
         id: "42",
         email: "alice@test.com",
         name: "alice",
      });
      expect(result.current.token).toBe(token);
   });

   it("rejects and clears expired token", async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 100;
      const token = makeJwt({ sub: "42", exp: pastExp });
      localStorage.setItem(STORAGE_KEY, token);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => {
         expect(result.current.status).toBe("unauthenticated");
      });
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
   });

   it("login sets user and token on success", async () => {
      mockFetch.mockResolvedValueOnce({
         ok: true,
         status: 200,
         json: () =>
            Promise.resolve({
               token: "new-tok",
               user: { id: 1, username: "bob", email: "bob@test.com" },
            }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() =>
         expect(result.current.status).toBe("unauthenticated")
      );

      let loginResult: { error?: string } = {};
      await act(async () => {
         loginResult = await result.current.login("bob", "pass123");
      });

      expect(loginResult.error).toBeUndefined();
      expect(result.current.status).toBe("authenticated");
      expect(result.current.user?.name).toBe("bob");
      expect(localStorage.getItem(STORAGE_KEY)).toBe("new-tok");
   });

   it("login returns error for email-not-verified", async () => {
      mockFetch.mockResolvedValueOnce({
         ok: false,
         status: 403,
         json: () =>
            Promise.resolve({ code: "EMAIL_NOT_VERIFIED", error: "Verify" }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() =>
         expect(result.current.status).toBe("unauthenticated")
      );

      let loginResult: { error?: string } = {};
      await act(async () => {
         loginResult = await result.current.login("bob", "pass");
      });

      expect(loginResult.error).toContain("verify");
   });

   it("login returns error on generic failure", async () => {
      mockFetch.mockResolvedValueOnce({
         ok: false,
         status: 401,
         json: () => Promise.resolve({ error: "Bad credentials" }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() =>
         expect(result.current.status).toBe("unauthenticated")
      );

      let loginResult: { error?: string } = {};
      await act(async () => {
         loginResult = await result.current.login("bob", "wrong");
      });

      expect(loginResult.error).toBe("Bad credentials");
   });

   it("logout clears state and localStorage", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const token = makeJwt({ sub: "1", username: "user", exp: futureExp });
      localStorage.setItem(STORAGE_KEY, token);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() =>
         expect(result.current.status).toBe("authenticated")
      );

      act(() => {
         result.current.logout();
      });

      expect(result.current.status).toBe("unauthenticated");
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
   });

   it("useAuth throws outside provider", () => {
      expect(() => {
         renderHook(() => useAuth());
      }).toThrow("useAuth must be used within AuthProvider");
   });
});
