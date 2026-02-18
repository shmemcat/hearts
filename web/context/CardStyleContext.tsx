"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

import { CARD_STYLE_KEY } from "@/lib/constants";

export type CardStyle = "standard" | "flourish";

type CardStyleContextValue = {
  cardStyle: CardStyle;
  setCardStyle: (style: CardStyle) => void;
};

const CardStyleContext = createContext<CardStyleContextValue | null>(null);

export function CardStyleProvider({ children }: { children: React.ReactNode }) {
  const [cardStyle, setCardStyleState] = useState<CardStyle>("standard");

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(CARD_STYLE_KEY)
        : null;
    if (stored === "flourish") setCardStyleState("flourish");
  }, []);

  const setCardStyle = (style: CardStyle) => {
    setCardStyleState(style);
    if (typeof window !== "undefined")
      localStorage.setItem(CARD_STYLE_KEY, style);
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
