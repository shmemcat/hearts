import { useLayoutEffect, useSyncExternalStore } from "react";

export const MOTION_OVERRIDE_KEY = "hearts.motion-override.v1";
const QUERY = "(prefers-reduced-motion: reduce)";
const CHANGE = "hearts:motion-preference-change";
let temporaryOverride: boolean | undefined;

export function animationsOverridden(): boolean {
   if (temporaryOverride !== undefined) return temporaryOverride;
   try {
      return localStorage.getItem(MOTION_OVERRIDE_KEY) === "true";
   } catch {
      return false;
   }
}

export function systemPrefersReducedMotion(): boolean {
   return window.matchMedia?.(QUERY).matches ?? false;
}

export function prefersReducedMotion(): boolean {
   return systemPrefersReducedMotion() && !animationsOverridden();
}

// A site-aware query for animations that already listen for preference changes.
// The browser's actual media query remains available for detecting the OS setting.
export function reducedMotionPreference() {
   const media = window.matchMedia?.(QUERY);
   return {
      get matches() {
         return Boolean(media?.matches) && !animationsOverridden();
      },
      addEventListener(_type: "change", listener: () => void) {
         if (media?.addEventListener)
            media.addEventListener("change", listener);
         else media?.addListener?.(listener);
         window.addEventListener(CHANGE, listener);
         window.addEventListener("storage", listener);
      },
      removeEventListener(_type: "change", listener: () => void) {
         if (media?.removeEventListener)
            media.removeEventListener("change", listener);
         else media?.removeListener?.(listener);
         window.removeEventListener(CHANGE, listener);
         window.removeEventListener("storage", listener);
      },
   };
}

function subscribe(listener: () => void) {
   const media = reducedMotionPreference();
   media.addEventListener("change", listener);
   return () => media.removeEventListener("change", listener);
}

export function syncMotionPreference() {
   document.documentElement.dataset.motionOverride = String(
      animationsOverridden()
   );
}

export function setAnimationsOverride(enabled: boolean): boolean {
   let saved = true;
   try {
      localStorage.setItem(MOTION_OVERRIDE_KEY, String(enabled));
      temporaryOverride = undefined;
   } catch {
      temporaryOverride = enabled;
      saved = false;
   }
   syncMotionPreference();
   window.dispatchEvent(new Event(CHANGE));
   return saved;
}

export function useMotionPreference() {
   const systemReduced = useSyncExternalStore(
      subscribe,
      systemPrefersReducedMotion
   );
   const overridden = useSyncExternalStore(subscribe, animationsOverridden);
   useLayoutEffect(syncMotionPreference, [overridden]);
   return { systemReduced, overridden, reduced: systemReduced && !overridden };
}

export function useReducedMotion() {
   return useMotionPreference().reduced;
}
