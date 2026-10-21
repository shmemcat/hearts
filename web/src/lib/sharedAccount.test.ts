import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
const session = {
   user: {
      id: "42",
      name: "existing_hearts",
      email: "hearts@example.test",
      email_verified: true,
   },
   csrf_token: "csrf-fixture",
};
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });

beforeEach(() => {
   vi.resetModules();
   vi.stubEnv("VITE_SHARED_ACCOUNTS", "true");
   vi.stubGlobal("fetch", mockFetch);
   mockFetch.mockReset();
   localStorage.clear();
});
afterEach(() => {
   vi.unstubAllEnvs();
   vi.unstubAllGlobals();
});

describe("shared account transport", () => {
   it("rejects changes when another tab has switched accounts", async () => {
      const api = await import("./sharedAccount");
      mockFetch.mockResolvedValueOnce(
         response({ ...session, user: { ...session.user, id: "99" } })
      );
      await expect(
         api.sharedAccountRequest("profile", { profile_icon: "cat" }, "42")
      ).rejects.toThrow("Your account changed");
      expect(mockFetch).toHaveBeenCalledTimes(1);
   });

   it("announces a revoked profile session to the current app", async () => {
      const api = await import("./sharedAccount");
      const changed = vi.fn();
      window.addEventListener("cards:session", changed);
      const guest = {
         user: null,
         csrf_token: "rotated",
         message: "Verify your new address",
      };
      mockFetch
         .mockResolvedValueOnce(response(session))
         .mockResolvedValueOnce(response(guest));
      await api.sharedAccountRequest(
         "profile",
         { email: "new@example.test" },
         "42"
      );
      expect(changed.mock.calls[0][0].detail).toEqual(guest);
      expect(api.getAuthToken()).toBeNull();
      window.removeEventListener("cards:session", changed);
   });
   it("uses an HttpOnly session and stores no browser token", async () => {
      const api = await import("./sharedAccount");
      mockFetch
         .mockResolvedValueOnce(
            response({ user: null, csrf_token: "guest-csrf" })
         )
         .mockResolvedValueOnce(response(session));
      const result = await api.sharedAccountRequest("login", {
         username: "existing_hearts",
         password: crypto.randomUUID(),
      });
      expect(result.user?.id).toBe("42");
      expect(mockFetch.mock.calls[1][1].headers["X-CSRF-Token"]).toBe(
         "guest-csrf"
      );
      expect(mockFetch.mock.calls[1][1].credentials).toBe("same-origin");
      expect(localStorage.length).toBe(0);
      expect(api.getAuthToken()).toBe(api.COOKIE_SESSION);
   });

   it("protects game requests and removes legacy bearer headers in shared mode", async () => {
      const api = await import("./sharedAccount");
      mockFetch
         .mockResolvedValueOnce(response(session))
         .mockResolvedValueOnce(response({}));
      await api.cardsFetch("/api/preferences", {
         method: "PATCH",
         headers: {
            Authorization: "Bearer old-token",
            "Content-Type": "application/json",
         },
         body: "{}",
      });
      const init = mockFetch.mock.calls[1][1];
      expect(init.headers.get("Authorization")).toBeNull();
      expect(init.headers.get("X-CSRF-Token")).toBe("csrf-fixture");
      expect(init.body).toBe("{}");
   });

   it("routes existing Hearts recovery forms to the shared service", async () => {
      const api = await import("./sharedAccount");
      mockFetch
         .mockResolvedValueOnce(response(session))
         .mockResolvedValueOnce(response({ message: "sent" }));
      await api.cardsFetch("/api/forgot-password", {
         method: "POST",
         body: "{}",
      });
      expect(mockFetch.mock.calls[1][0]).toContain(
         "/api/account/forgot-password"
      );
   });

   it("never sends account CSRF tokens to a foreign origin", async () => {
      const api = await import("./sharedAccount");
      mockFetch.mockResolvedValueOnce(response({}));
      await api.cardsFetch("https://example.test/api/preferences", {
         method: "PATCH",
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][1].headers).toBeUndefined();
   });

   it("preserves the body of a Request object while adding CSRF", async () => {
      const api = await import("./sharedAccount");
      mockFetch
         .mockResolvedValueOnce(response(session))
         .mockResolvedValueOnce(response({}));
      const request = new Request(
         new URL("/api/preferences", window.location.href),
         {
            method: "PATCH",
            headers: {
               Authorization: "Bearer old-token",
               "Content-Type": "application/json",
            },
            body: '{"card_style":"classic"}',
         }
      );
      await api.cardsFetch(request);
      const forwarded = mockFetch.mock.calls[1][0] as Request;
      expect(await forwarded.text()).toBe('{"card_style":"classic"}');
      expect(forwarded.headers.get("Authorization")).toBeNull();
      expect(forwarded.headers.get("X-CSRF-Token")).toBe("csrf-fixture");
   });

   it("preserves existing API calls when shared accounts are disabled", async () => {
      vi.stubEnv("VITE_SHARED_ACCOUNTS", "false");
      const api = await import("./sharedAccount");
      mockFetch.mockResolvedValueOnce(response({}));
      const options = { headers: { Authorization: "Bearer legacy" } };
      await api.cardsFetch("/api/me", options);
      expect(mockFetch).toHaveBeenCalledWith("/api/me", options);
   });
});
