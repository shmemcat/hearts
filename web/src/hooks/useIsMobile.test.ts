import { renderHook, act } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { useIsMobile } from "./useIsMobile";

let listeners: Map<string, ((e: { matches: boolean }) => void)[]>;

beforeEach(() => {
   listeners = new Map();
   vi.mocked(window.matchMedia).mockImplementation((query: string) => {
      const mql = {
         matches: false,
         media: query,
         onchange: null,
         addListener: vi.fn(),
         removeListener: vi.fn(),
         addEventListener: vi.fn(
            (_, handler: (e: { matches: boolean }) => void) => {
               const arr = listeners.get(query) ?? [];
               arr.push(handler);
               listeners.set(query, arr);
            }
         ),
         removeEventListener: vi.fn(),
         dispatchEvent: vi.fn(),
      };
      return mql as unknown as MediaQueryList;
   });
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe("useIsMobile", () => {
   it("returns false by default (desktop)", () => {
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);
   });

   it("returns true when matchMedia matches", () => {
      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
         matches: true,
         media: query,
         onchange: null,
         addListener: vi.fn(),
         removeListener: vi.fn(),
         addEventListener: vi.fn(),
         removeEventListener: vi.fn(),
         dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);
   });

   it("uses custom breakpoint", () => {
      renderHook(() => useIsMobile(1024));
      expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 1024px)");
   });

   it("reacts to media query changes", () => {
      const { result } = renderHook(() => useIsMobile(768));
      expect(result.current).toBe(false);

      const handlers = listeners.get("(max-width: 768px)") ?? [];
      expect(handlers.length).toBeGreaterThan(0);

      act(() => {
         handlers.forEach((h) => h({ matches: true }));
      });
      expect(result.current).toBe(true);
   });
});
