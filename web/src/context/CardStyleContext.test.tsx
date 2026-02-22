import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { AuthProvider } from "@/context/AuthContext";
import { CardStyleProvider, useCardStyle } from "./CardStyleContext";
import { CARD_STYLE_KEY } from "@/lib/constants";

beforeEach(() => {
   localStorage.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});

function wrapper({ children }: { children: React.ReactNode }) {
   return (
      <AuthProvider>
         <CardStyleProvider>{children}</CardStyleProvider>
      </AuthProvider>
   );
}

describe("CardStyleContext", () => {
   it("defaults to standard style", () => {
      const { result } = renderHook(() => useCardStyle(), { wrapper });
      expect(result.current.cardStyle).toBe("standard");
   });

   it("hydrates flourish from localStorage", async () => {
      localStorage.setItem(CARD_STYLE_KEY, "flourish");
      const { result } = renderHook(() => useCardStyle(), { wrapper });
      await waitFor(() => {
         expect(result.current.cardStyle).toBe("flourish");
      });
   });

   it("setCardStyle updates state and localStorage", () => {
      const { result } = renderHook(() => useCardStyle(), { wrapper });
      act(() => {
         result.current.setCardStyle("flourish");
      });
      expect(result.current.cardStyle).toBe("flourish");
      expect(localStorage.getItem(CARD_STYLE_KEY)).toBe("flourish");
   });

   it("setCardStyle back to standard", () => {
      const { result } = renderHook(() => useCardStyle(), { wrapper });
      act(() => {
         result.current.setCardStyle("flourish");
      });
      act(() => {
         result.current.setCardStyle("standard");
      });
      expect(result.current.cardStyle).toBe("standard");
      expect(localStorage.getItem(CARD_STYLE_KEY)).toBe("standard");
   });

   it("useCardStyle throws outside provider", () => {
      expect(() => {
         renderHook(() => useCardStyle());
      }).toThrow("useCardStyle must be used within CardStyleProvider");
   });
});
