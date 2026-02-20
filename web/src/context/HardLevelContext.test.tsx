import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { HardLevelProvider, useHardLevel } from "./HardLevelContext";
import { HARD_LEVEL_KEY, HARD_LEVEL_CHANGED_KEY } from "@/lib/constants";

beforeEach(() => {
   localStorage.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});

function wrapper({ children }: { children: React.ReactNode }) {
   return <HardLevelProvider>{children}</HardLevelProvider>;
}

describe("HardLevelContext", () => {
   it("defaults to hard", () => {
      const { result } = renderHook(() => useHardLevel(), { wrapper });
      expect(result.current.hardLevel).toBe("hard");
      expect(result.current.hasChanged).toBe(false);
   });

   it("hydrates level from localStorage", async () => {
      localStorage.setItem(HARD_LEVEL_KEY, "harder");
      localStorage.setItem(HARD_LEVEL_CHANGED_KEY, "1");
      const { result } = renderHook(() => useHardLevel(), { wrapper });
      await waitFor(() => {
         expect(result.current.hardLevel).toBe("harder");
         expect(result.current.hasChanged).toBe(true);
      });
   });

   it("setHardLevel updates state, localStorage, and hasChanged", () => {
      const { result } = renderHook(() => useHardLevel(), { wrapper });
      act(() => {
         result.current.setHardLevel("hardest");
      });
      expect(result.current.hardLevel).toBe("hardest");
      expect(result.current.hasChanged).toBe(true);
      expect(localStorage.getItem(HARD_LEVEL_KEY)).toBe("hardest");
      expect(localStorage.getItem(HARD_LEVEL_CHANGED_KEY)).toBe("1");
   });

   it("ignores invalid localStorage values", async () => {
      localStorage.setItem(HARD_LEVEL_KEY, "banana");
      const { result } = renderHook(() => useHardLevel(), { wrapper });
      await waitFor(() => {
         expect(result.current.hardLevel).toBe("hard");
      });
   });

   it("useHardLevel throws outside provider", () => {
      expect(() => {
         renderHook(() => useHardLevel());
      }).toThrow("useHardLevel must be used within HardLevelProvider");
   });
});
