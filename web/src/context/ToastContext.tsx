import React, {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useLayoutEffect,
   useMemo,
   useRef,
   useState,
} from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import {
   readSeenAchievements,
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
   const scope = useMemo(() => ({ userId }), [userId]);
   const activeScopeRef = useRef(scope);
   const [queue, setQueue] = useState({
      scope,
      items: [] as AchievementToast[],
   });
   const announcedRef = useRef(new Set<string>());
   const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(
      new Map()
   );

   // Reset notifications without remounting the app or its running game.
   useLayoutEffect(() => {
      activeScopeRef.current = scope;
      timerRefs.current.forEach((timer) => clearTimeout(timer));
      timerRefs.current.clear();
      setQueue((previous) =>
         previous.scope === scope ? previous : { scope, items: [] }
      );
   }, [scope]);

   // Claim and persist before scheduling a toast so socket, HTTP and profile
   // notifications cannot announce the same achievement twice.
   const claimToast = useCallback(
      (achievementId: string) => {
         if (activeScopeRef.current !== scope) return false;
         const key = `${userId ?? "guest"}:${achievementId}`;
         if (announcedRef.current.has(key)) return false;
         const seen = userId
            ? readSeenAchievements(userId) ?? new Set<string>()
            : new Set<string>();
         const prefix = `${userId ?? "guest"}:`;
         announcedRef.current.forEach((id) => {
            if (id.startsWith(prefix)) seen.add(id.slice(prefix.length));
         });
         if (hasSeenAchievement(seen, achievementId)) return false;
         if (userId) {
            markAchievementsSeen(userId, [achievementId]);
         }
         announcedRef.current.add(key);
         return true;
      },
      [userId, scope]
   );

   const removeToast = useCallback((id: string) => {
      setQueue((prev) => ({
         ...prev,
         items: prev.items.filter((t) => t.id !== id),
      }));
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
         setQueue((prev) => ({
            ...prev,
            items: prev.items.map((t) =>
               t.id === id ? { ...t, exiting: true } : t
            ),
         }));
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

   useEffect(() => {
      if (queue.scope !== scope) return;
      // Only visible entries use their three seconds; queued awards wait their turn.
      queue.items.slice(0, MAX_VISIBLE_TOASTS).forEach((toast) => {
         if (!toast.exiting && !timerRefs.current.has(toast.id))
            scheduleRemoval(toast.id);
      });
   }, [queue, scope, scheduleRemoval]);

   const addToast = useCallback(
      (toast: Omit<AchievementToast, "id">) => {
         if (!claimToast(toast.achievementId)) return;
         const id = `${toast.achievementId}-${Date.now()}`;
         setQueue((prev) => ({
            scope,
            items: [
               ...(prev.scope === scope ? prev.items : []),
               { ...toast, id },
            ],
         }));
      },
      [scope, claimToast]
   );

   const addToasts = useCallback(
      (items: Omit<AchievementToast, "id">[]) => {
         const unseen = items.filter((toast) =>
            claimToast(toast.achievementId)
         );
         if (unseen.length === 0) return;

         unseen.forEach((toast, i) => {
            const timer = setTimeout(() => {
               timerRefs.current.delete(`stagger-${toast.achievementId}`);
               if (activeScopeRef.current !== scope) return;
               const id = `${toast.achievementId}-${Date.now()}`;
               setQueue((prev) => ({
                  scope,
                  items: [
                     ...(prev.scope === scope ? prev.items : []),
                     { ...toast, id },
                  ],
               }));
            }, i * TOAST_STAGGER_MS);
            timerRefs.current.set(`stagger-${toast.achievementId}`, timer);
         });
      },
      [scope, claimToast]
   );

   useEffect(() => {
      const timers = timerRefs.current;
      return () => {
         timers.forEach((timer) => clearTimeout(timer));
         timers.clear();
      };
   }, []);

   return (
      <ToastContext.Provider value={{ addToast, addToasts }}>
         {children}
         {typeof document !== "undefined" &&
            createPortal(
               <ToastStack
                  toasts={queue.scope === scope ? queue.items : []}
                  onDismiss={startExit}
               />,
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
      <div
         className={styles.toastStack}
         role="status"
         aria-live="polite"
         aria-atomic="true"
      >
         {toasts.slice(0, MAX_VISIBLE_TOASTS).map((toast) => (
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
