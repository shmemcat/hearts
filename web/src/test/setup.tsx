import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// ── localStorage polyfill (Node 22+ has a broken native localStorage) ─
const storage: Record<string, string> = {};
const localStorageMock: Storage = {
   getItem: (key: string) => storage[key] ?? null,
   setItem: (key: string, value: string) => { storage[key] = String(value); },
   removeItem: (key: string) => { delete storage[key]; },
   clear: () => { for (const k of Object.keys(storage)) delete storage[k]; },
   get length() { return Object.keys(storage).length; },
   key: (i: number) => Object.keys(storage)[i] ?? null,
};
Object.defineProperty(globalThis, "localStorage", {
   value: localStorageMock,
   writable: true,
   configurable: true,
});

beforeEach(() => {
   localStorageMock.clear();
});

afterEach(() => {
   cleanup();
});

// ── matchMedia mock (needed by useIsMobile, ThemeContext) ────────────
Object.defineProperty(window, "matchMedia", {
   writable: true,
   value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
   })),
});

// ── howler mock ──────────────────────────────────────────────────────
vi.mock("howler", () => {
   class HowlMock {
      play = vi.fn();
      pause = vi.fn();
      stop = vi.fn();
      volume = vi.fn();
      mute = vi.fn();
      on = vi.fn();
      off = vi.fn();
      once = vi.fn();
      unload = vi.fn();
   }
   return { Howl: HowlMock, Howler: {} };
});

// ── party-js mock ────────────────────────────────────────────────────
vi.mock("party-js", () => ({
   default: {
      confetti: vi.fn(),
      variation: { range: vi.fn().mockReturnValue(100) },
   },
   confetti: vi.fn(),
   variation: { range: vi.fn().mockReturnValue(100) },
}));

// ── framer-motion mock ───────────────────────────────────────────────
vi.mock("framer-motion", async () => {
   const actual = await vi.importActual<typeof import("framer-motion")>(
      "framer-motion"
   );
   return {
      ...actual,
      AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
      motion: new Proxy(
         {},
         {
            get: (_target, prop: string) => {
               return ({
                  children,
                  ...rest
               }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => {
                  const Element = prop as keyof JSX.IntrinsicElements;
                  const safeProps: Record<string, unknown> = {};
                  for (const [k, v] of Object.entries(rest)) {
                     if (
                        !k.startsWith("animate") &&
                        !k.startsWith("initial") &&
                        !k.startsWith("exit") &&
                        !k.startsWith("transition") &&
                        !k.startsWith("variants") &&
                        !k.startsWith("whileHover") &&
                        !k.startsWith("whileTap") &&
                        !k.startsWith("layout") &&
                        k !== "drag" &&
                        k !== "dragConstraints"
                     ) {
                        safeProps[k] = v;
                     }
                  }
                  return <Element {...(safeProps as any)}>{children}</Element>;
               };
            },
         }
      ),
   };
});
