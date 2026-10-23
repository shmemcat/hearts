import { getApiUrl, getGameApiUrl } from "./api";
import { afterEach, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("getApiUrl", () => {
   it("returns /api as the default fallback", () => {
      expect(getApiUrl()).toBe("/api");
   });
   it("keeps account and game API bases separate", () => {
      expect(getGameApiUrl()).toBe("/api/hearts");
      expect(getApiUrl()).toBe("/api");
      vi.stubEnv("VITE_API_URL", "https://cards.example/api/");
      expect(getGameApiUrl()).toBe("https://cards.example/api/hearts");
   });
});
