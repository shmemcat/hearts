import React, { createContext, useContext, useEffect, useState } from "react";

import { getApiUrl } from "@/lib/api";
import { MOBILE_LAYOUT_KEY, STORAGE_KEY } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";

export type MobileLayout = "single" | "double";

const VALID: Set<string> = new Set(["single", "double"]);

type MobileLayoutContextValue = {
   mobileLayout: MobileLayout;
   setMobileLayout: (layout: MobileLayout) => void;
};

const MobileLayoutContext = createContext<MobileLayoutContextValue | null>(
   null
);

export function MobileLayoutProvider({
   children,
}: {
   children: React.ReactNode;
}) {
   const { status, preferences } = useAuth();
   const [mobileLayout, setMobileLayoutState] =
      useState<MobileLayout>("single");

   useEffect(() => {
      if (status === "loading") return;

      const stored =
         typeof window !== "undefined"
            ? localStorage.getItem(MOBILE_LAYOUT_KEY)
            : null;

      if (status === "authenticated" && preferences) {
         if (VALID.has(preferences.mobile_layout))
            setMobileLayoutState(preferences.mobile_layout as MobileLayout);
         return;
      }

      if (status === "authenticated" && !preferences) {
         if (stored && VALID.has(stored)) {
            setMobileLayoutState(stored as MobileLayout);
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
                  body: JSON.stringify({ mobile_layout: stored }),
               }).catch(() => {});
            }
         }
         return;
      }

      if (stored && VALID.has(stored))
         setMobileLayoutState(stored as MobileLayout);
   }, [status, preferences]);

   const setMobileLayout = (layout: MobileLayout) => {
      setMobileLayoutState(layout);

      if (typeof window !== "undefined")
         localStorage.setItem(MOBILE_LAYOUT_KEY, layout);

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
            body: JSON.stringify({ mobile_layout: layout }),
         }).catch(() => {});
      }
   };

   return (
      <MobileLayoutContext.Provider value={{ mobileLayout, setMobileLayout }}>
         {children}
      </MobileLayoutContext.Provider>
   );
}

export function useMobileLayout(): MobileLayoutContextValue {
   const ctx = useContext(MobileLayoutContext);
   if (!ctx)
      throw new Error(
         "useMobileLayout must be used within MobileLayoutProvider"
      );
   return ctx;
}
