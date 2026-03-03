import React, {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useRef,
   useState,
} from "react";
import { Howl } from "howler";

import {
   SOUND_MUTED_KEY,
   SOUND_VOLUME_KEY,
   MUSIC_MUTED_KEY,
   MUSIC_VOLUME_KEY,
} from "@/lib/constants";

/* ── Sound registry ──────────────────────────────────────────────────── */

type SoundName =
   | "cardFan"
   | "cardSlide"
   | "cardSweep"
   | "cardPlace"
   | "heartDelta"
   | "heartsBroken"
   | "playerJoin"
   | "roundEnd"
   | "gameEnd"
   | "shootTheMoon"
   | "soundOn";

const SOUND_SOURCES: Record<SoundName, string[]> = {
   cardFan: ["/sounds/card-fan-1.mp3", "/sounds/card-fan-2.mp3"],
   cardSlide: [
      "/sounds/card-slide-1.mp3",
      "/sounds/card-slide-2.mp3",
      "/sounds/card-slide-3.mp3",
      "/sounds/card-slide-4.mp3",
      "/sounds/card-slide-5.mp3",
      "/sounds/card-slide-6.mp3",
      "/sounds/card-slide-7.mp3",
      "/sounds/card-slide-8.mp3",
   ],
   cardSweep: ["/sounds/cards-sweep-1.mp3", "/sounds/cards-sweep-2.mp3"],
   cardPlace: ["/sounds/card-place-1.mp3", "/sounds/card-place-2.mp3"],
   heartDelta: ["/sounds/pop.mp3", "/sounds/plopp.mp3"],
   heartsBroken: ["/sounds/hearts-broken.mp3"],
   playerJoin: ["/sounds/pop.mp3", "/sounds/plopp.mp3"],
   roundEnd: ["/sounds/round-end.mp3"],
   gameEnd: ["/sounds/game-end.mp3"],
   shootTheMoon: ["/sounds/shoot-the-moon.mp3"],
   soundOn: ["/sounds/sound-on.mp3"],
};

function pickRandom<T>(arr: T[]): T {
   return arr[Math.floor(Math.random() * arr.length)];
}

/* ── Context value ───────────────────────────────────────────────────── */

interface SoundContextValue {
   muted: boolean;
   setMuted: (m: boolean) => void;
   volume: number;
   setVolume: (v: number) => void;
   play: (name: SoundName) => void;
   musicMuted: boolean;
   setMusicMuted: (m: boolean) => void;
   musicVolume: number;
   setMusicVolume: (v: number) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

/* ── Provider ────────────────────────────────────────────────────────── */

function readBool(key: string, fallback: boolean): boolean {
   if (typeof window === "undefined") return fallback;
   const v = localStorage.getItem(key);
   return v != null ? v === "true" : fallback;
}

function readNum(key: string, fallback: number): number {
   if (typeof window === "undefined") return fallback;
   const raw = localStorage.getItem(key);
   if (raw == null) return fallback;
   const v = parseFloat(raw);
   return isNaN(v) ? fallback : Math.max(0, Math.min(1, v));
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
   const [muted, setMutedState] = useState(() =>
      readBool(SOUND_MUTED_KEY, false)
   );
   const [volume, setVolumeState] = useState(() =>
      readNum(SOUND_VOLUME_KEY, 0.15)
   );
   const [musicMuted, setMusicMutedState] = useState(() =>
      readBool(MUSIC_MUTED_KEY, false)
   );
   const [musicVolume, setMusicVolumeState] = useState(() =>
      readNum(MUSIC_VOLUME_KEY, 0.15)
   );

   const howlsRef = useRef<Record<SoundName, Howl[]> | null>(null);
   const musicHowlRef = useRef<Howl | null>(null);
   const mutedRef = useRef(muted);
   const volumeRef = useRef(volume);
   const musicMutedRef = useRef(musicMuted);
   const musicVolumeRef = useRef(musicVolume);

   mutedRef.current = muted;
   volumeRef.current = volume;
   musicMutedRef.current = musicMuted;
   musicVolumeRef.current = musicVolume;

   // Pre-load all sound effects
   useEffect(() => {
      if (typeof window === "undefined") return;
      const howls = {} as Record<SoundName, Howl[]>;
      for (const [name, srcs] of Object.entries(SOUND_SOURCES)) {
         howls[name as SoundName] = srcs.map(
            (src) =>
               new Howl({
                  src: [src],
                  preload: true,
                  volume: volumeRef.current,
               })
         );
      }
      howlsRef.current = howls;
   }, []);

   // Create music loop Howl and manage playback
   useEffect(() => {
      if (typeof window === "undefined") return;
      const howl = new Howl({
         src: ["/sounds/music-loop.mp3"],
         loop: true,
         preload: true,
         volume: musicVolumeRef.current,
      });
      musicHowlRef.current = howl;

      if (!musicMutedRef.current) {
         howl.play();
      }

      return () => {
         howl.unload();
         musicHowlRef.current = null;
      };
   }, []);

   // Persist + apply muted
   const setMuted = useCallback((m: boolean) => {
      setMutedState(m);
      if (typeof window !== "undefined")
         localStorage.setItem(SOUND_MUTED_KEY, String(m));
   }, []);

   // Persist + apply volume, and update all Howl instances
   const setVolume = useCallback((v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setVolumeState(clamped);
      if (typeof window !== "undefined")
         localStorage.setItem(SOUND_VOLUME_KEY, String(clamped));
      if (howlsRef.current) {
         for (const group of Object.values(howlsRef.current)) {
            for (const h of group) h.volume(clamped);
         }
      }
   }, []);

   const play = useCallback((name: SoundName) => {
      if (mutedRef.current) return;
      const group = howlsRef.current?.[name];
      if (!group || group.length === 0) return;
      const howl = pickRandom(group);
      howl.volume(volumeRef.current);
      howl.play();
   }, []);

   const setMusicMuted = useCallback((m: boolean) => {
      setMusicMutedState(m);
      if (typeof window !== "undefined")
         localStorage.setItem(MUSIC_MUTED_KEY, String(m));
      const howl = musicHowlRef.current;
      if (!howl) return;
      if (m) {
         howl.pause();
      } else {
         howl.play();
      }
   }, []);

   const setMusicVolume = useCallback((v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setMusicVolumeState(clamped);
      if (typeof window !== "undefined")
         localStorage.setItem(MUSIC_VOLUME_KEY, String(clamped));
      musicHowlRef.current?.volume(clamped);
   }, []);

   return (
      <SoundContext.Provider
         value={{
            muted,
            setMuted,
            volume,
            setVolume,
            play,
            musicMuted,
            setMusicMuted,
            musicVolume,
            setMusicVolume,
         }}
      >
         {children}
      </SoundContext.Provider>
   );
}

/* ── Hook ────────────────────────────────────────────────────────────── */

export function useSound(): SoundContextValue {
   const ctx = useContext(SoundContext);
   if (!ctx) throw new Error("useSound must be used within SoundProvider");
   return ctx;
}

export type { SoundName };
