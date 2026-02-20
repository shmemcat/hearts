import { getApiUrl } from "./api";

describe("getApiUrl", () => {
   it("returns /api as the default fallback", () => {
      expect(getApiUrl()).toBe("/api");
   });
});
