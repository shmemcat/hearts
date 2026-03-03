import React from "react";
import styles from "@/styles/buttons.module.css";

interface ToggleButtonGroupProps<T extends string> {
   options: { value: T; label: string }[];
   value: T;
   onChange: (value: T) => void;
}

export function ToggleButtonGroup<T extends string>({
   options,
   value,
   onChange,
}: ToggleButtonGroupProps<T>) {
   return (
      <div className={styles["toggle-group"]}>
         {options.map((opt) => {
            const active = opt.value === value;
            return (
               <button
                  key={opt.value}
                  className={`${styles["toggle-button"]}${
                     active ? ` ${styles["toggle-button-active"]}` : ""
                  }`}
                  onClick={() => onChange(opt.value)}
                  type="button"
                  aria-pressed={active}
                  tabIndex={-1}
               >
                  {!active && <div className={styles["button-shine"]} />}
                  {opt.label}
               </button>
            );
         })}
      </div>
   );
}
