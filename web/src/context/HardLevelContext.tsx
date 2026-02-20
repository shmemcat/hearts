import React, { createContext, useContext, useEffect, useState } from "react";

import { HARD_LEVEL_KEY, HARD_LEVEL_CHANGED_KEY } from "@/lib/constants";

export type HardLevel = "hard" | "harder" | "hardest";

const VALID_LEVELS: Set<string> = new Set(["hard", "harder", "hardest"]);

type HardLevelContextValue = {
   hardLevel: HardLevel;
   setHardLevel: (level: HardLevel) => void;
   hasChanged: boolean;
};

const HardLevelContext = createContext<HardLevelContextValue | null>(null);

export function HardLevelProvider({ children }: { children: React.ReactNode }) {
   const [hardLevel, setHardLevelState] = useState<HardLevel>("hard");
   const [hasChanged, setHasChanged] = useState(false);

   useEffect(() => {
      if (typeof window === "undefined") return;
      const stored = localStorage.getItem(HARD_LEVEL_KEY);
      if (stored && VALID_LEVELS.has(stored))
         setHardLevelState(stored as HardLevel);
      if (localStorage.getItem(HARD_LEVEL_CHANGED_KEY) === "1")
         setHasChanged(true);
   }, []);

   const setHardLevel = (level: HardLevel) => {
      setHardLevelState(level);
      setHasChanged(true);
      if (typeof window !== "undefined") {
         localStorage.setItem(HARD_LEVEL_KEY, level);
         localStorage.setItem(HARD_LEVEL_CHANGED_KEY, "1");
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
