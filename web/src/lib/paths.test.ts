import { afterEach, describe, expect, it, vi } from "vitest";
import { gamePath } from "./paths";

afterEach(() => vi.unstubAllEnvs());

describe("game paths at the Cards home", () => {
   it("keeps public files and invitations inside Hearts", () => {
      vi.stubEnv("BASE_URL", "/hearts/");
      expect(gamePath("/cards/As.png")).toBe("/hearts/cards/As.png");
      expect(gamePath("sounds/music-loop.mp3")).toBe(
         "/hearts/sounds/music-loop.mp3"
      );
      expect(gamePath("game/lobby/ABC123")).toBe("/hearts/game/lobby/ABC123");
   });
});
