import {
   act,
   cleanup,
   fireEvent,
   render,
   screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AnimationOption } from "./AnimationOption";
import {
   MOTION_OVERRIDE_KEY,
   prefersReducedMotion,
   reducedMotionPreference,
   setAnimationsOverride,
} from "../lib/motionPreference";

let systemReduced = false;
const changes = new Set<() => void>();

beforeEach(() => {
   setAnimationsOverride(false);
   localStorage.removeItem(MOTION_OVERRIDE_KEY);
   systemReduced = false;
   changes.clear();
   vi.stubGlobal("matchMedia", (query: string) => ({
      get matches() {
         return query === "(prefers-reduced-motion: reduce)" && systemReduced;
      },
      addEventListener: (_type: string, listener: () => void) =>
         changes.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
         changes.delete(listener),
   }));
});

afterEach(() => {
   cleanup();
   vi.restoreAllMocks();
   vi.unstubAllGlobals();
   setAnimationsOverride(false);
});

function changeSystem(reduced: boolean) {
   act(() => {
      systemReduced = reduced;
      changes.forEach((listener) => listener());
   });
}

it("hides the override unless the device requests reduced motion", () => {
   render(<AnimationOption />);
   expect(screen.queryByRole("radiogroup", { name: "Animations" })).toBeNull();
   changeSystem(true);
   expect(screen.getAllByRole("radio")).toHaveLength(2);
   expect(
      screen.getByRole<HTMLInputElement>("radio", {
         name: "Keep animations disabled (default)",
      }).checked
   ).toBe(true);
   expect(prefersReducedMotion()).toBe(true);
   expect(localStorage.getItem(MOTION_OVERRIDE_KEY)).toBeNull();
});

it("restores either choice across visits and keeps the override controls visible", () => {
   systemReduced = true;
   const first = render(<AnimationOption />);
   fireEvent.click(
      screen.getByRole("radio", { name: "Show website animations" })
   );
   expect(prefersReducedMotion()).toBe(false);
   expect(document.documentElement.dataset.motionOverride).toBe("true");
   expect(screen.getByRole("radiogroup", { name: "Animations" })).toBeTruthy();
   first.unmount();
   const second = render(<AnimationOption />);
   expect(
      screen.getByRole<HTMLInputElement>("radio", {
         name: "Show website animations",
      }).checked
   ).toBe(true);
   fireEvent.click(
      screen.getByRole("radio", { name: "Keep animations disabled (default)" })
   );
   expect(prefersReducedMotion()).toBe(true);
   expect(document.documentElement.dataset.motionOverride).toBe("false");
   second.unmount();
   render(<AnimationOption />);
   expect(
      screen.getByRole<HTMLInputElement>("radio", {
         name: "Keep animations disabled (default)",
      }).checked
   ).toBe(true);
});

it("follows device changes without forgetting an explicit override", () => {
   systemReduced = true;
   render(<AnimationOption />);
   fireEvent.click(
      screen.getByRole("radio", { name: "Show website animations" })
   );
   changeSystem(false);
   expect(screen.queryByRole("radio")).toBeNull();
   expect(prefersReducedMotion()).toBe(false);
   changeSystem(true);
   expect(
      screen.getByRole<HTMLInputElement>("radio", {
         name: "Show website animations",
      }).checked
   ).toBe(true);
   expect(prefersReducedMotion()).toBe(false);
});

it("updates the controls and animation listeners when another tab changes the choice", () => {
   systemReduced = true;
   render(<AnimationOption />);
   const media = reducedMotionPreference();
   const listener = vi.fn();
   media.addEventListener("change", listener);
   act(() => {
      localStorage.setItem(MOTION_OVERRIDE_KEY, "true");
      window.dispatchEvent(
         new StorageEvent("storage", { key: MOTION_OVERRIDE_KEY })
      );
   });
   expect(
      screen.getByRole<HTMLInputElement>("radio", {
         name: "Show website animations",
      }).checked
   ).toBe(true);
   expect(media.matches).toBe(false);
   expect(listener).toHaveBeenCalledTimes(1);
   expect(document.documentElement.dataset.motionOverride).toBe("true");
   media.removeEventListener("change", listener);
   act(() => setAnimationsOverride(false));
   expect(listener).toHaveBeenCalledTimes(1);
});

it("allows a temporary override and explains when the choice cannot be saved", () => {
   systemReduced = true;
   render(<AnimationOption />);
   vi.spyOn(
      Object.getPrototypeOf(localStorage) === Object.prototype
         ? localStorage
         : Object.getPrototypeOf(localStorage),
      "setItem"
   ).mockImplementation(() => {
      throw new Error("Storage full");
   });
   fireEvent.click(
      screen.getByRole("radio", { name: "Show website animations" })
   );
   expect(
      screen.getByRole<HTMLInputElement>("radio", {
         name: "Show website animations",
      }).checked
   ).toBe(true);
   expect(prefersReducedMotion()).toBe(false);
   expect(screen.getByRole("alert").textContent).toContain(
      "It will apply for this visit."
   );
   fireEvent.click(
      screen.getByRole("radio", { name: "Keep animations disabled (default)" })
   );
   expect(prefersReducedMotion()).toBe(true);
});

it("keeps the default when storage is unreadable or contains an unrecognized value", () => {
   systemReduced = true;
   localStorage.setItem(MOTION_OVERRIDE_KEY, "unexpected");
   expect(prefersReducedMotion()).toBe(true);
   vi.spyOn(
      Object.getPrototypeOf(localStorage) === Object.prototype
         ? localStorage
         : Object.getPrototypeOf(localStorage),
      "getItem"
   ).mockImplementation(() => {
      throw new Error("Storage unavailable");
   });
   render(<AnimationOption />);
   expect(
      screen.getByRole<HTMLInputElement>("radio", {
         name: "Keep animations disabled (default)",
      }).checked
   ).toBe(true);
});

it("hides the option when the browser cannot detect reduced motion", () => {
   vi.stubGlobal("matchMedia", undefined);
   render(<AnimationOption />);
   expect(screen.queryByRole("radio")).toBeNull();
   expect(prefersReducedMotion()).toBe(false);
});
