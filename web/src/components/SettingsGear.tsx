import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/pro-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
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
   const triggerRef = useRef<HTMLButtonElement>(null);
   const { pathname } = useLocation();
   useEffect(() => setOpen(false), [pathname]);
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
      const escape = (event: KeyboardEvent) => {
         if (event.key === "Escape") {
            setOpen(false);
            triggerRef.current?.focus();
         }
      };
      document.addEventListener("pointerdown", handler);
      document.addEventListener("keydown", escape);
      return () => {
         document.removeEventListener("pointerdown", handler);
         document.removeEventListener("keydown", escape);
      };
   }, [open]);

   return (
      <div ref={wrapRef} className={styles.wrap} data-modal-open={open}>
         <button
            ref={triggerRef}
            type="button"
            className={styles.gearBtn}
            onClick={() => setOpen((v) => !v)}
            aria-label="Settings menu"
            aria-expanded={open}
         >
            <FontAwesomeIcon icon={faGear} />
         </button>
         <div className={styles.drop} hidden={!open}>
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

const GEAR_ROUTES: Record<string, string | undefined> = {
   "/user": undefined,
   "/profile": "/profile",
   "/options": "/options",
};

export function GearOverlay() {
   const { user } = useAuth();
   const { pathname } = useLocation();

   const isGearPage = pathname in GEAR_ROUTES;
   const show = isGearPage && !!user;

   return (
      <div className={styles.overlay}>
         <div className={styles.overlayMirror}>
            <AnimatePresence>
               {show && (
                  <motion.div
                     key="gear"
                     className={styles.overlayGear}
                     initial={{ opacity: 0, y: -12 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 12 }}
                     transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                     <SettingsGear exclude={GEAR_ROUTES[pathname]} />
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>
   );
}
