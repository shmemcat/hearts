import React from "react";

import styles from "@/styles/play.module.css";

export interface PhaseHintProps {
   /** Text to display. When null/undefined, the element stays in the DOM but is invisible to preserve layout. */
   text: string | null;
   /** When true, applies a gentle shake animation. */
   shake?: boolean;
}

/** Always-rendered hint line between the game table and the hand. Hides via visibility when there's no text to avoid layout shifts. */
export const PhaseHint: React.FC<PhaseHintProps> = ({ text, shake }) => {
   const className = [styles.phaseHint, shake && styles.phaseHintShake]
      .filter(Boolean)
      .join(" ");

   return (
      <p
         className={className}
         style={text ? undefined : { visibility: "hidden", opacity: 0 }}
         aria-hidden={!text}
      >
         {/* Render a non-breaking space when hidden so the element keeps its line-height */}
         {text ?? "\u00A0"}
      </p>
   );
};
