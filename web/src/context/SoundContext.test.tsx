import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import { SoundProvider, useSound } from "./SoundContext";
import {
   MUSIC_MUTED_KEY,
   SOUND_MUTED_KEY,
   SOUND_VOLUME_KEY,
} from "@/lib/constants";
import { installMusicLocks } from "@/test/musicLocks";
import type { HowlOptions } from "howler";

vi.mock("howler", () => ({
   Howl: class {
      active = false;
      unlock?: () => void;
      play = vi.fn(() => {
         this.active = true;
         return 1;
      });
      pause = vi.fn(() => {
         this.active = false;
      });
      unload = vi.fn(() => {
         this.active = false;
      });
      volume = vi.fn();
      playing = () => this.active;
      once = vi.fn((_event: string, callback: () => void) => {
         this.unlock = callback;
      });
      constructor(public options: HowlOptions) {
         if (options.loop) musicTracks.push(this);
      }
   },
}));
let musicTracks: {
   active: boolean;
   options: HowlOptions;
   play: ReturnType<typeof vi.fn>;
   pause: ReturnType<typeof vi.fn>;
   unload: ReturnType<typeof vi.fn>;
   unlock?: () => void;
}[];

beforeEach(() => {
   localStorage.clear();
   musicTracks = [];
   installMusicLocks();
});

afterEach(() => {
   vi.restoreAllMocks();
   vi.unstubAllGlobals();
});

function wrapper({ children }: { children: React.ReactNode }) {
   return <SoundProvider>{children}</SoundProvider>;
}

describe("Music across tabs", () => {
   const renderSound = () => renderHook(useSound, { wrapper });

   it("plays in one tab and hands off when its music is muted", async () => {
      const first = renderSound();
      renderSound();
      expect(musicTracks[0].active).toBe(true);
      expect(musicTracks[1].play).not.toHaveBeenCalled();
      await act(async () => first.result.current.setMusicMuted(true));
      expect(musicTracks[0].active).toBe(false);
      expect(musicTracks[1].active).toBe(true);
   });

   it("does not layer playback when repeatedly enabling music", () => {
      const { result } = renderSound();
      act(() => result.current.setMusicMuted(false));
      act(() => result.current.setMusicMuted(false));
      expect(musicTracks[0].play).toHaveBeenCalledOnce();
   });

   it("hands off when the owner closes and skips a closed waiting tab", async () => {
      const first = renderSound();
      const waiting = renderSound();
      renderSound();
      waiting.unmount();
      await act(async () => first.unmount());
      expect(musicTracks[1].play).not.toHaveBeenCalled();
      expect(musicTracks[2].active).toBe(true);
   });

   it("does not request playback while music is muted", () => {
      localStorage.setItem(MUSIC_MUTED_KEY, "true");
      renderSound();
      expect(musicTracks[0].play).not.toHaveBeenCalled();
   });

   it("ignores autoplay unlock callbacks after losing ownership", () => {
      renderSound();
      const current = musicTracks[0];
      current.active = false;
      act(() => current.options.onplayerror?.(1, "Autoplay blocked"));
      act(() => window.dispatchEvent(new Event("pagehide")));
      act(() => current.unlock?.());
      expect(current.play).toHaveBeenCalledOnce();
      current.active = true;
      act(() => current.options.onplay?.(1));
      expect(current.active).toBe(false);
   });
});

describe("SoundContext", () => {
   it("defaults to not muted, volume 0.15", () => {
      const { result } = renderHook(() => useSound(), { wrapper });
      expect(result.current.muted).toBe(false);
      expect(result.current.volume).toBe(0.15);
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
