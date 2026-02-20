import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

beforeEach(() => {
   localStorage.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});

function wrapper({ children }: { children: React.ReactNode }) {
   return <ThemeProvider>{children}</ThemeProvider>;
}

describe("ThemeContext", () => {
   it("defaults to system theme", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe("system");
   });

   it("resolves system theme to light when prefers-color-scheme is light", () => {
      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
         matches: query.includes("dark") ? false : true,
         media: query,
         onchange: null,
         addListener: vi.fn(),
         removeListener: vi.fn(),
         addEventListener: vi.fn(),
         removeEventListener: vi.fn(),
         dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.resolvedTheme).toBe("light");
   });

   it("resolves system theme to dark when prefers-color-scheme is dark", () => {
      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
         matches: query.includes("dark") ? true : false,
         media: query,
         onchange: null,
         addListener: vi.fn(),
         removeListener: vi.fn(),
         addEventListener: vi.fn(),
         removeEventListener: vi.fn(),
         dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.resolvedTheme).toBe("dark");
   });

   it("setTheme persists to localStorage", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      act(() => {
         result.current.setTheme("dark");
      });
      expect(result.current.theme).toBe("dark");
      expect(result.current.resolvedTheme).toBe("dark");
      expect(localStorage.getItem("theme")).toBe("dark");
   });

   it("setTheme to system removes localStorage entry", () => {
      localStorage.setItem("theme", "dark");
      const { result } = renderHook(() => useTheme(), { wrapper });
      act(() => {
         result.current.setTheme("system");
      });
      expect(result.current.theme).toBe("system");
      expect(localStorage.getItem("theme")).toBeNull();
   });

   it("reads stored theme from localStorage", () => {
      localStorage.setItem("theme", "light");
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe("light");
      expect(result.current.resolvedTheme).toBe("light");
   });

   it("sets data-theme attribute on document", async () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      act(() => {
         result.current.setTheme("dark");
      });
      await waitFor(() => {
         expect(document.documentElement.getAttribute("data-theme")).toBe(
            "dark"
         );
      });
   });

   it("useTheme throws outside provider", () => {
      expect(() => {
         renderHook(() => useTheme());
      }).toThrow("useTheme must be used within ThemeProvider");
   });
});
