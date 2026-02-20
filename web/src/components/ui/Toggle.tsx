import React from "react";
import styles from "./Toggle.module.css";

export interface ToggleProps {
   /** Controlled checked state */
   checked: boolean;
   /** Called when the user toggles */
   onCheckedChange: (checked: boolean) => void;
   disabled?: boolean;
   "aria-label": string;
   className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
   checked,
   onCheckedChange,
   disabled = false,
   "aria-label": ariaLabel,
   className,
}) => (
   <label
      className={`${styles.toggleLabel} ${checked ? styles.checked : ""} ${
         className ?? ""
      }`.trim()}
   >
      <input
         type="checkbox"
         className={styles.toggleInput}
         checked={checked}
         onChange={(e) => onCheckedChange(e.target.checked)}
         disabled={disabled}
         aria-label={ariaLabel}
      />
      <span className={styles.track} />
      <span className={styles.thumb} aria-hidden />
   </label>
);
