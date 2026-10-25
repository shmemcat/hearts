// Keep this lock name shared by Hearts, Euchre, and Golf, which share an origin.
const MUSIC_LOCK = "cards.background-music.v1";

/** Hold exclusive playback until disabled, unmounted, or the page is left. */
export function requestMusicPlayback(setOwner: (owner: boolean) => void) {
   let disposed = false;
   let pageActive = true;
   let controller: AbortController | undefined;
   let release: (() => void) | undefined;
   let focusedOnly = !navigator.locks?.request;
   let owner = false;

   const updateOwner = (next: boolean) => {
      if (owner === next) return;
      owner = next;
      setOwner(next);
   };
   // Without Web Locks (for example on HTTP), only the focused tab may play.
   const updateFocus = () => {
      if (focusedOnly) {
         updateOwner(
            !disposed && pageActive && !document.hidden && document.hasFocus()
         );
      }
   };
   const start = () => {
      if (disposed || !pageActive || controller) return;
      if (focusedOnly) {
         updateFocus();
         return;
      }
      const request = new AbortController();
      controller = request;
      void navigator.locks
         .request(MUSIC_LOCK, { signal: request.signal }, async () => {
            if (disposed || !pageActive || request.signal.aborted) return;
            await new Promise<void>((resolve) => {
               release = resolve;
               updateOwner(true);
            });
         })
         .catch(() => {
            if (disposed || request.signal.aborted) return;
            controller = undefined;
            focusedOnly = true;
            updateFocus();
         });
   };
   const stop = () => {
      // Silence the old owner before making the lock available to another tab.
      updateOwner(false);
      controller?.abort();
      controller = undefined;
      release?.();
      release = undefined;
   };
   const hide = () => {
      pageActive = false;
      stop();
   };
   const show = () => {
      pageActive = true;
      start();
   };
   const blur = () => {
      if (focusedOnly) updateOwner(false);
   };

   window.addEventListener("pagehide", hide);
   window.addEventListener("pageshow", show);
   window.addEventListener("focus", updateFocus);
   window.addEventListener("blur", blur);
   document.addEventListener("visibilitychange", updateFocus);
   start();

   return () => {
      disposed = true;
      stop();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      window.removeEventListener("focus", updateFocus);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", updateFocus);
   };
}
