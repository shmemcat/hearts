import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { SoundProvider, useSound } from "./SoundContext";
import { SOUND_MUTED_KEY, SOUND_VOLUME_KEY } from "@/lib/constants";

beforeEach(() => {
   localStorage.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});

function wrapper({ children }: { children: React.ReactNode }) {
   return <SoundProvider>{children}</SoundProvider>;
}

describe("SoundContext", () => {
   it("defaults to not muted, volume 0.25", () => {
      const { result } = renderHook(() => useSound(), { wrapper });
      expect(result.current.muted).toBe(false);
      expect(result.current.volume).toBe(0.25);
   });

   it("hydrates muted from localStorage", async () => {
      localStorage.setItem(SOUND_MUTED_KEY, "true");
      const { result } = renderHook(() => useSound(), { wrapper });
      await waitFor(() => {
         expect(result.current.muted).toBe(true);
      });
   });

   it("hydrates volume from localStorage", async () => {
      localStorage.setItem(SOUND_VOLUME_KEY, "0.8");
      const { result } = renderHook(() => useSound(), { wrapper });
      await waitFor(() => {
         expect(result.current.volume).toBe(0.8);
      });
   });

   it("clamps volume to [0, 1]", async () => {
      localStorage.setItem(SOUND_VOLUME_KEY, "5");
      const { result } = renderHook(() => useSound(), { wrapper });
      await waitFor(() => {
         expect(result.current.volume).toBe(1);
      });
   });

   it("setMuted updates state and persists", () => {
      const { result } = renderHook(() => useSound(), { wrapper });
      act(() => {
         result.current.setMuted(true);
      });
      expect(result.current.muted).toBe(true);
      expect(localStorage.getItem(SOUND_MUTED_KEY)).toBe("true");
   });

   it("setVolume updates state and persists", () => {
      const { result } = renderHook(() => useSound(), { wrapper });
      act(() => {
         result.current.setVolume(0.7);
      });
      expect(result.current.volume).toBe(0.7);
      expect(localStorage.getItem(SOUND_VOLUME_KEY)).toBe("0.7");
   });

   it("setVolume clamps values", () => {
      const { result } = renderHook(() => useSound(), { wrapper });
      act(() => {
         result.current.setVolume(-0.5);
      });
      expect(result.current.volume).toBe(0);

      act(() => {
         result.current.setVolume(2);
      });
      expect(result.current.volume).toBe(1);
   });

   it("play does not throw", () => {
      const { result } = renderHook(() => useSound(), { wrapper });
      expect(() => {
         act(() => {
            result.current.play("cardSlide");
         });
      }).not.toThrow();
   });

   it("useSound throws outside provider", () => {
      expect(() => {
         renderHook(() => useSound());
      }).toThrow("useSound must be used within SoundProvider");
   });
});
