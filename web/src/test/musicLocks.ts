import { vi } from "vitest";

/** Model browser locks, including queued requests and asynchronous handoff. */
export function installMusicLocks() {
   let held = false;
   const queue: (() => void)[] = [];
   const request = vi.fn(
      (name: string, options: LockOptions, callback: LockGrantedCallback) =>
         new Promise<void>((resolve, reject) => {
            const abort = () => {
               const index = queue.indexOf(grant);
               if (index >= 0) queue.splice(index, 1);
               reject(new DOMException("Aborted", "AbortError"));
            };
            const grant = () => {
               options.signal?.removeEventListener("abort", abort);
               held = true;
               Promise.resolve(callback({ name, mode: "exclusive" } as Lock))
                  .then(() => resolve(), reject)
                  .finally(() => {
                     held = false;
                     queue.shift()?.();
                  });
            };
            if (options.signal?.aborted) return abort();
            options.signal?.addEventListener("abort", abort, { once: true });
            if (held) queue.push(grant);
            else grant();
         })
   );
   vi.stubGlobal(
      "navigator",
      Object.create(navigator, {
         locks: { value: { request } },
      })
   );
   return request;
}
