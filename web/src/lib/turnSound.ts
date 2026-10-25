export const TURN_SOUNDS = [
   { value: "pop", label: "Pop", file: "sound-on.mp3" },
   { value: "chime", label: "Chime", file: "chime.mp3" },
   { value: "ding", label: "Ding", file: "ding.mp3" },
   { value: "notification", label: "Notification", file: "notification.mp3" },
] as const;

export type TurnSoundName = (typeof TURN_SOUNDS)[number]["value"];
export type TurnSoundOptions = { sound: TurnSoundName; volume: number };
export type TurnSoundUpdate = Partial<TurnSoundOptions & { enabled: boolean }>;
export type GameTurnSoundOptions = Partial<
   Record<"golf" | "euchre" | "hearts", TurnSoundOptions>
>;
export const DEFAULT_TURN_SOUND: TurnSoundOptions = {
   sound: "pop",
   volume: 0.15,
};

export function normalizeTurnSound(
   value?: Partial<TurnSoundOptions>
): TurnSoundOptions {
   return {
      sound: TURN_SOUNDS.some((option) => option.value === value?.sound)
         ? value!.sound!
         : DEFAULT_TURN_SOUND.sound,
      volume:
         typeof value?.volume === "number" && Number.isFinite(value.volume)
            ? Math.max(0, Math.min(1, value.volume))
            : DEFAULT_TURN_SOUND.volume,
   };
}

// A separate playback channel lets card effects be quiet while turn alerts are loud.
export function createTurnSoundPlayer() {
   let current: HTMLAudioElement | null = null;
   let finished: (() => void) | undefined;
   const stop = () => {
      const old = current;
      const done = finished;
      current = null;
      finished = undefined;
      if (old) {
         old.onended = null;
         old.onerror = null;
         old.pause();
         old.currentTime = 0;
      }
      done?.();
   };
   return {
      stop,
      setVolume(volume: number) {
         if (current) current.volume = normalizeTurnSound({ volume }).volume;
      },
      play(
         sound: TurnSoundName,
         volume: number,
         onStop?: () => void,
         onError?: () => void
      ) {
         stop();
         const option =
            TURN_SOUNDS.find((option) => option.value === sound) ??
            TURN_SOUNDS[0];
         let audio: HTMLAudioElement;
         try {
            audio = new Audio(
               `${import.meta.env.BASE_URL}sounds/${option.file}`
            );
            audio.volume = normalizeTurnSound({ volume }).volume;
            current = audio;
            finished = onStop;
            audio.onended = () => {
               if (current === audio) stop();
            };
            const failed = () => {
               if (current !== audio) return;
               stop();
               onError?.();
            };
            audio.onerror = failed;
            void audio.play()?.catch(failed);
         } catch {
            stop();
            onError?.();
         }
      },
   };
}
