import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestMusicPlayback } from "./musicPlayback";
import { installMusicLocks } from "@/test/musicLocks";

let cleanups: (() => void)[];
const flush = async () => {
   for (let i = 0; i < 10; i++) await Promise.resolve();
};
const requestPlayback = (callback: (owner: boolean) => void) => {
   const cleanup = requestMusicPlayback(callback);
   cleanups.push(cleanup);
   return cleanup;
};
beforeEach(() => {
   cleanups = [];
   installMusicLocks();
});
afterEach(async () => {
   cleanups.forEach((cleanup) => cleanup());
   await flush();
   vi.restoreAllMocks();
   vi.unstubAllGlobals();
});

describe("Exclusive music playback", () => {
   it("serializes simultaneous tabs and silences each owner before handoff", async () => {
      let playing = 0;
      let peak = 0;
      const owners = Array.from({ length: 5 }, () =>
         vi.fn((active: boolean) => {
            playing += active ? 1 : -1;
            peak = Math.max(peak, playing);
         })
      );
      const releases = owners.map((owner) => requestPlayback(owner));
      expect(playing).toBe(1);
      expect(owners[0]).toHaveBeenCalledWith(true);
      expect(owners[1]).not.toHaveBeenCalled();
      for (const release of releases) {
         release();
         await flush();
      }
      expect(owners.every((owner) => owner.mock.calls.length === 2)).toBe(true);
      expect(peak).toBe(1);
      expect(playing).toBe(0);
   });

   it("cancels a waiting tab before it can acquire playback", async () => {
      const first = vi.fn();
      const waiting = vi.fn();
      const third = vi.fn();
      const release = requestPlayback(first);
      requestPlayback(waiting)();
      requestPlayback(third);
      release();
      await flush();
      expect(waiting).not.toHaveBeenCalled();
      expect(third).toHaveBeenCalledWith(true);
   });

   it("does not resurrect a cancelled tab during an asynchronous handoff", async () => {
      const release = requestPlayback(vi.fn());
      const waiting = vi.fn();
      const cancel = requestPlayback(waiting);
      release();
      cancel();
      await flush();
      expect(waiting).not.toHaveBeenCalled();
   });

   it("releases on pagehide and reacquires after a cached page is restored", async () => {
      const owner = vi.fn();
      requestPlayback(owner);
      window.dispatchEvent(new Event("pagehide"));
      expect(owner.mock.calls).toEqual([[true], [false]]);
      await flush();
      window.dispatchEvent(new Event("pageshow"));
      expect(owner.mock.calls).toEqual([[true], [false], [true]]);
   });

   it("removes lifecycle listeners on cleanup", () => {
      const owner = vi.fn();
      requestPlayback(owner)();
      window.dispatchEvent(new Event("pageshow"));
      expect(owner.mock.calls).toEqual([[true], [false]]);
   });

   it("restricts playback to the focused visible page without Web Locks", () => {
      vi.stubGlobal("navigator", {});
      const focus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
      const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
      const owner = vi.fn();
      requestPlayback(owner);
      expect(owner).not.toHaveBeenCalled();
      focus.mockReturnValue(true);
      window.dispatchEvent(new Event("focus"));
      expect(owner).toHaveBeenLastCalledWith(true);
      hidden.mockReturnValue(true);
      document.dispatchEvent(new Event("visibilitychange"));
      expect(owner).toHaveBeenLastCalledWith(false);
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event("visibilitychange"));
      focus.mockReturnValue(false);
      window.dispatchEvent(new Event("blur"));
      expect(owner.mock.calls).toEqual([[true], [false], [true], [false]]);
   });

   it("uses focused playback if the browser refuses lock requests", async () => {
      vi.stubGlobal("navigator", {
         locks: {
            request: vi.fn().mockRejectedValue(new Error("Unavailable")),
         },
      });
      vi.spyOn(document, "hidden", "get").mockReturnValue(false);
      vi.spyOn(document, "hasFocus").mockReturnValue(true);
      const owner = vi.fn();
      requestPlayback(owner);
      await flush();
      expect(owner).toHaveBeenCalledWith(true);
   });
});
