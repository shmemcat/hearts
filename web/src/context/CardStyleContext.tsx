import React, { createContext, useContext, useEffect, useState } from "react";

import { getApiUrl } from "@/lib/api";
import { CARD_STYLE_KEY, STORAGE_KEY } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";

export type CardStyle = "standard" | "flourish";

const VALID: Set<string> = new Set(["standard", "flourish"]);

type CardStyleContextValue = {
   cardStyle: CardStyle;
   setCardStyle: (style: CardStyle) => void;
};

const CardStyleContext = createContext<CardStyleContextValue | null>(null);

export function CardStyleProvider({ children }: { children: React.ReactNode }) {
   const { status, preferences } = useAuth();
   const [cardStyle, setCardStyleState] = useState<CardStyle>("standard");

   useEffect(() => {
      if (status === "loading") return;

      const stored =
         typeof window !== "undefined"
            ? localStorage.getItem(CARD_STYLE_KEY)
            : null;

      if (status === "authenticated" && preferences) {
         if (VALID.has(preferences.card_style))
            setCardStyleState(preferences.card_style as CardStyle);
         return;
      }

      if (status === "authenticated" && !preferences) {
         if (stored && VALID.has(stored)) {
            setCardStyleState(stored as CardStyle);
            const token = localStorage.getItem(STORAGE_KEY);
            if (token) {
               fetch(`${getApiUrl()}/preferences`, {
                  method: "PATCH",
                  headers: {
                     "Content-Type": "application/json",
                     Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ card_style: stored }),
               }).catch(() => {});
            }
         }
         return;
      }

      if (stored && VALID.has(stored)) setCardStyleState(stored as CardStyle);
   }, [status, preferences]);

   const setCardStyle = (style: CardStyle) => {
      setCardStyleState(style);

      if (typeof window !== "undefined")
         localStorage.setItem(CARD_STYLE_KEY, style);

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
            body: JSON.stringify({ card_style: style }),
         }).catch(() => {});
      }
   };

   return (
      <CardStyleContext.Provider value={{ cardStyle, setCardStyle }}>
         {children}
      </CardStyleContext.Provider>
   );
}

export function useCardStyle(): CardStyleContextValue {
   const ctx = useContext(CardStyleContext);
   if (!ctx)
      throw new Error("useCardStyle must be used within CardStyleProvider");
   return ctx;
}
