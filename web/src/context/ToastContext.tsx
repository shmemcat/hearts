import React, {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useRef,
   useState,
} from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import {
   getSeenAchievements,
   hasSeenAchievement,
   markAchievementsSeen,
} from "@/lib/achievements";
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
   const { user } = useAuth();
   const userId = user?.id;
   const [toasts, setToasts] = useState<AchievementToast[]>([]);
   const announcedRef = useRef(new Set<string>());
   const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(
      new Map()
   );

   // Claim and persist before scheduling a toast so socket, HTTP and profile
   // notifications cannot announce the same achievement twice.
   const claimToast = useCallback(
      (achievementId: string) => {
         const key = `${userId ?? "guest"}:${achievementId}`;
         if (announcedRef.current.has(key)) return false;
         if (userId) {
            const seen = getSeenAchievements(
               localStorage.getItem(`hearts_seen_achievements_${userId}`)
            );
            if (hasSeenAchievement(seen, achievementId)) return false;
            markAchievementsSeen(userId, [achievementId]);
         }
         announcedRef.current.add(key);
         return true;
      },
      [userId]
   );

   const removeToast = useCallback((id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      for (const key of [id, `exit-${id}`]) {
         const timer = timerRefs.current.get(key);
         if (timer !== undefined) clearTimeout(timer);
         timerRefs.current.delete(key);
      }
   }, []);

   const startExit = useCallback(
      (id: string) => {
         if (timerRefs.current.has(`exit-${id}`)) return;
         const scheduled = timerRefs.current.get(id);
         if (scheduled !== undefined) clearTimeout(scheduled);
         timerRefs.current.delete(id);
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
         if (!claimToast(toast.achievementId)) return;
         const id = `${toast.achievementId}-${Date.now()}`;
         setToasts((prev) => [...prev, { ...toast, id }]);
         scheduleRemoval(id);
      },
      [scheduleRemoval, claimToast]
   );

   const addToasts = useCallback(
      (items: Omit<AchievementToast, "id">[]) => {
         const unseen = items.filter((toast) =>
            claimToast(toast.achievementId)
         );
         if (unseen.length === 0) return;

         const toShow =
            unseen.length > MAX_VISIBLE_TOASTS
               ? unseen.slice(0, MAX_VISIBLE_TOASTS)
               : unseen;
         const extra = unseen.length - toShow.length;

         toShow.forEach((toast, i) => {
            const timer = setTimeout(() => {
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
            timerRefs.current.set(`stagger-${toast.achievementId}`, timer);
         });
      },
      [scheduleRemoval, claimToast]
   );

   useEffect(() => {
      const timers = timerRefs.current;
      return () => {
         timers.forEach((timer) => clearTimeout(timer));
      };
   }, []);

   return (
      <ToastContext.Provider value={{ addToast, addToasts }}>
         {children}
         {typeof document !== "undefined" &&
            createPortal(
               <ToastStack toasts={toasts} onDismiss={startExit} />,
               document.body
            )}
      </ToastContext.Provider>
   );
}

function ToastStack({
   toasts,
   onDismiss,
}: {
   toasts: AchievementToast[];
   onDismiss: (id: string) => void;
}) {
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
               <button
                  type="button"
                  className={styles.toastDismiss}
                  aria-label={`Dismiss ${toast.name} achievement notification`}
                  disabled={toast.exiting}
                  onClick={() => onDismiss(toast.id)}
               >
                  ×
               </button>
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
