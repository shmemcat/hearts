"use client";

import React from "react";

import { SUIT_RED, SUIT_SYMBOL } from "@/lib/constants";
import styles from "@/styles/card.module.css";

/** Parse card code "2c" | "10d" | "Js" | "Ah" into rank and suit. */
function parseCode(code: string): { rank: string; suit: string } {
  const s = code.trim();
  if (!s || s.length < 2) return { rank: "?", suit: "?" };
  const suit = s.slice(-1).toLowerCase();
  const rank = s.slice(0, -1);
  return { rank, suit };
}

export interface CardProps {
  code: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Card size: normal (hand), medium (table trick) */
  size?: "normal" | "medium";
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  code,
  selected = false,
  disabled = false,
  onClick,
  size = "normal",
  className,
}) => {
  const { rank, suit } = parseCode(code);
  const isRed = SUIT_RED.has(suit);
  const symbol = SUIT_SYMBOL[suit] ?? "?";

  const handleClick = () => {
    if (disabled || !onClick) return;
    onClick();
  };

  return (
    <button
      type="button"
      className={[
        styles.card,
        size === "medium" ? styles.cardMedium : "",
        selected ? styles.cardSelected : "",
        disabled && onClick ? styles.cardDisabled : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      disabled={disabled && !!onClick}
      aria-label={`Card ${rank} of ${suit}`}
    >
      <span className={isRed ? styles.rankRed : styles.rankBlack}>{rank}</span>
      <span className={isRed ? styles.suitRed : styles.suitBlack}>{symbol}</span>
    </button>
  );
};
