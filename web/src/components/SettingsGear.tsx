import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/pro-solid-svg-icons";
import styles from "./SettingsGear.module.css";

const MENU_ITEMS = [
   { to: "/profile", label: "Profile" },
   { to: "/options", label: "Options" },
];

interface SettingsGearProps {
   /** Path to exclude from the dropdown (the current page) */
   exclude?: string;
}

export const SettingsGear: React.FC<SettingsGearProps> = ({ exclude }) => {
   const [open, setOpen] = useState(false);
   const wrapRef = useRef<HTMLDivElement>(null);
   const items = exclude
      ? MENU_ITEMS.filter((item) => item.to !== exclude)
      : MENU_ITEMS;

   useEffect(() => {
      if (!open) return;
      const handler = (e: PointerEvent) => {
         if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
            setOpen(false);
         }
      };
      document.addEventListener("pointerdown", handler);
      return () => document.removeEventListener("pointerdown", handler);
   }, [open]);

   return (
      <div ref={wrapRef} className={styles.wrap} data-modal-open={open}>
         <button
            type="button"
            className={styles.gearBtn}
            onClick={() => setOpen((v) => !v)}
            aria-label="Settings menu"
            aria-expanded={open}
         >
            <FontAwesomeIcon icon={faGear} />
         </button>
         <div className={styles.drop}>
            <div className={styles.inner}>
               {items.map((item) => (
                  <Link
                     key={item.to}
                     to={item.to}
                     className={styles.menuItem}
                     onClick={() => setOpen(false)}
                  >
                     {item.label}
                  </Link>
               ))}
            </div>
         </div>
      </div>
   );
};
