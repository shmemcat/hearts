import React, { createContext, useContext, useEffect, useState } from "react";

import { getApiUrl } from "@/lib/api";
import {
   HARD_LEVEL_KEY,
   HARD_LEVEL_CHANGED_KEY,
   STORAGE_KEY,
} from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";

export type HardLevel = "hard" | "harder" | "hardest";

const VALID_LEVELS: Set<string> = new Set(["hard", "harder", "hardest"]);

type HardLevelContextValue = {
   hardLevel: HardLevel;
   setHardLevel: (level: HardLevel) => void;
   hasChanged: boolean;
};

const HardLevelContext = createContext<HardLevelContextValue | null>(null);

export function HardLevelProvider({ children }: { children: React.ReactNode }) {
   const { status, preferences } = useAuth();
   const [hardLevel, setHardLevelState] = useState<HardLevel>("hard");
   const [hasChanged, setHasChanged] = useState(false);

   useEffect(() => {
      if (status === "loading") return;
      if (typeof window === "undefined") return;

      const stored = localStorage.getItem(HARD_LEVEL_KEY);
      const storedChanged =
         localStorage.getItem(HARD_LEVEL_CHANGED_KEY) === "1";

      if (status === "authenticated" && preferences) {
         if (VALID_LEVELS.has(preferences.hard_level)) {
            setHardLevelState(preferences.hard_level as HardLevel);
            if (preferences.hard_level !== "hard") setHasChanged(true);
         }
         return;
      }

      if (status === "authenticated" && !preferences) {
         if (stored && VALID_LEVELS.has(stored)) {
            setHardLevelState(stored as HardLevel);
            if (storedChanged) setHasChanged(true);
            const token = localStorage.getItem(STORAGE_KEY);
            if (token) {
               fetch(`${getApiUrl()}/preferences`, {
                  method: "PATCH",
                  headers: {
                     "Content-Type": "application/json",
                     Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ hard_level: stored }),
               }).catch(() => {});
            }
         }
         return;
      }

      if (stored && VALID_LEVELS.has(stored))
         setHardLevelState(stored as HardLevel);
      if (storedChanged) setHasChanged(true);
   }, [status, preferences]);

   const setHardLevel = (level: HardLevel) => {
      setHardLevelState(level);
      setHasChanged(true);
      if (typeof window !== "undefined") {
         localStorage.setItem(HARD_LEVEL_KEY, level);
         localStorage.setItem(HARD_LEVEL_CHANGED_KEY, "1");
      }

      const token =
         typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null;
      if (token) {
         fetch(`${getApiUrl()}/preferences`, {
            method: "PATCH",
            headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ hard_level: level }),
         }).catch(() => {});
      }
   };

   return (
      <HardLevelContext.Provider
         value={{ hardLevel, setHardLevel, hasChanged }}
      >
         {children}
      </HardLevelContext.Provider>
   );
}

export function useHardLevel(): HardLevelContextValue {
   const ctx = useContext(HardLevelContext);
   if (!ctx)
      throw new Error("useHardLevel must be used within HardLevelProvider");
   return ctx;
}
