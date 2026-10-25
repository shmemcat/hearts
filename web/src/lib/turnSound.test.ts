import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTurnSoundPlayer, normalizeTurnSound } from "./turnSound";

const clips: FakeAudio[] = [];
class FakeAudio {
   volume = 1;
   currentTime = 0;
   onended: (() => void) | null = null;
   onerror: (() => void) | null = null;
   play = vi.fn().mockResolvedValue(undefined);
   pause = vi.fn();
   constructor(public src: string) {
      clips.push(this);
   }
}
beforeEach(() => {
   clips.length = 0;
   vi.stubGlobal("Audio", FakeAudio);
});
afterEach(() => vi.unstubAllGlobals());

it("keeps Pop on the existing indicator file and uses its own volume", () => {
   const player = createTurnSoundPlayer();
   player.play("pop", 0.73);
   expect(clips[0].src).toBe(`${import.meta.env.BASE_URL}sounds/sound-on.mp3`);
   expect(clips[0].volume).toBe(0.73);
   expect(clips[0].play).toHaveBeenCalledOnce();
});
it("plays supplied sounds without overlapping another preview or turn cue", () => {
   const player = createTurnSoundPlayer();
   const done = vi.fn();
   player.play("chime", 0.6, done);
   player.play("ding", 0.9);
   expect(clips[0].pause).toHaveBeenCalledOnce();
   expect(done).toHaveBeenCalledOnce();
   expect(clips[1].src).toBe(`${import.meta.env.BASE_URL}sounds/ding.mp3`);
   player.setVolume(0.2);
   expect(clips[1].volume).toBe(0.2);
   player.stop();
   expect(clips[1].pause).toHaveBeenCalledOnce();
});
it("finishes preview controls on playback completion and reports media failures", () => {
   const player = createTurnSoundPlayer();
   const done = vi.fn(),
      failed = vi.fn();
   player.play("notification", 0.5, done, failed);
   clips[0].onended?.();
   expect(done).toHaveBeenCalledOnce();
   player.play("notification", 0.5, done, failed);
   clips[1].onerror?.();
   expect(failed).toHaveBeenCalledOnce();
   expect(done).toHaveBeenCalledTimes(2);
});
it("clamps invalid levels and defaults to the existing effect level", () => {
   expect(normalizeTurnSound()).toEqual({ sound: "pop", volume: 0.15 });
   expect(normalizeTurnSound({ volume: Infinity }).volume).toBe(0.15);
   expect(normalizeTurnSound({ volume: 5 }).volume).toBe(1);
   expect(normalizeTurnSound({ volume: -1 }).volume).toBe(0);
});
