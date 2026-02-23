import React, {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useRef,
   useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "@/styles/achievements.module.css";
import {
   TOAST_DURATION_MS,
   TOAST_EXIT_MS,
   TOAST_STAGGER_MS,
   MAX_VISIBLE_TOASTS,
} from "@/lib/constants";

export type AchievementToast = {
   id: string;
   achievementId: string;
   name: string;
   icon: React.ReactNode;
   tier?: "bronze" | "silver" | "gold" | null;
   exiting?: boolean;
};

interface ToastContextValue {
   addToast: (toast: Omit<AchievementToast, "id">) => void;
   addToasts: (toasts: Omit<AchievementToast, "id">[]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
   const [toasts, setToasts] = useState<AchievementToast[]>([]);
   const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(
      new Map()
   );

   const removeToast = useCallback((id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      const timer = timerRefs.current.get(id);
      if (timer) {
         clearTimeout(timer);
         timerRefs.current.delete(id);
      }
   }, []);

   const startExit = useCallback(
      (id: string) => {
         setToasts((prev) =>
            prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
         );
         const timer = setTimeout(() => removeToast(id), TOAST_EXIT_MS);
         timerRefs.current.set(`exit-${id}`, timer);
      },
      [removeToast]
   );

   const scheduleRemoval = useCallback(
      (id: string) => {
         const timer = setTimeout(() => startExit(id), TOAST_DURATION_MS);
         timerRefs.current.set(id, timer);
      },
      [startExit]
   );

   const addToast = useCallback(
      (toast: Omit<AchievementToast, "id">) => {
         const id = `${toast.achievementId}-${Date.now()}`;
         setToasts((prev) => [...prev, { ...toast, id }]);
         scheduleRemoval(id);
      },
      [scheduleRemoval]
   );

   const addToasts = useCallback(
      (items: Omit<AchievementToast, "id">[]) => {
         if (items.length === 0) return;

         const toShow =
            items.length > MAX_VISIBLE_TOASTS
               ? items.slice(0, MAX_VISIBLE_TOASTS)
               : items;
         const extra = items.length - toShow.length;

         toShow.forEach((toast, i) => {
            setTimeout(() => {
               const id = `${toast.achievementId}-${Date.now()}`;
               const isLast = i === toShow.length - 1 && extra > 0;
               const entry: AchievementToast = isLast
                  ? {
                       ...toast,
                       id,
                       name: `${toast.name} (+${extra} more)`,
                    }
                  : { ...toast, id };
               setToasts((prev) => [...prev, entry]);
               scheduleRemoval(id);
            }, i * TOAST_STAGGER_MS);
         });
      },
      [scheduleRemoval]
   );

   useEffect(() => {
      return () => {
         timerRefs.current.forEach((timer) => clearTimeout(timer));
      };
   }, []);

   return (
      <ToastContext.Provider value={{ addToast, addToasts }}>
         {children}
         {typeof document !== "undefined" &&
            createPortal(<ToastStack toasts={toasts} />, document.body)}
      </ToastContext.Provider>
   );
}

function ToastStack({ toasts }: { toasts: AchievementToast[] }) {
   if (toasts.length === 0) return null;

   return (
      <div className={styles.toastStack}>
         {toasts.map((toast) => (
            <div
               key={toast.id}
               className={`${styles.toast} ${
                  toast.exiting ? styles.toast_exiting : ""
               }`}
            >
               <div
                  className={`${styles.toastIcon} ${
                     toast.tier ? styles[`toastIcon_${toast.tier}`] : ""
                  }`}
               >
                  {toast.icon}
               </div>
               <div className={styles.toastText}>
                  <div className={styles.toastLabel}>Achievement Unlocked!</div>
                  <div className={styles.toastName}>{toast.name}</div>
               </div>
            </div>
         ))}
      </div>
   );
}

export function useToast(): ToastContextValue {
   const ctx = useContext(ToastContext);
   if (!ctx) throw new Error("useToast must be used within ToastProvider");
   return ctx;
}
