import { act, fireEvent, renderHook, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ToastProvider, useToast } from "./ToastContext";
import {
   TOAST_DURATION_MS,
   TOAST_EXIT_MS,
   TOAST_STAGGER_MS,
} from "@/lib/constants";

const auth = vi.hoisted(() => ({
   user: { id: "alice" } as { id: string } | null,
}));
vi.mock("@/context/AuthContext", () => ({
   useAuth: () => ({ user: auth.user }),
}));
const toast = { achievementId: "night_owl", name: "Night Owl", icon: "moon" };
function wrapper({ children }: { children: React.ReactNode }) {
   return <ToastProvider>{children}</ToastProvider>;
}

beforeEach(() => {
   auth.user = { id: "alice" };
   vi.useFakeTimers();
});
afterEach(() => {
   vi.useRealTimers();
   vi.restoreAllMocks();
});

it("persists a game toast and suppresses duplicate socket, HTTP and profile notifications", () => {
   const { result } = renderHook(useToast, { wrapper });
   act(() => {
      result.current.addToast(toast);
      result.current.addToast(toast);
      result.current.addToasts([toast]);
   });
   act(() => vi.advanceTimersByTime(1));
   expect(screen.getAllByText("Night Owl")).toHaveLength(1);
   expect(
      JSON.parse(localStorage.getItem("hearts_seen_achievements_alice")!)
   ).toContain("night_owl");
   act(() => vi.advanceTimersByTime(TOAST_DURATION_MS + TOAST_EXIT_MS));
   act(() => result.current.addToasts([toast]));
   act(() => vi.advanceTimersByTime(1));
   expect(screen.queryByText("Night Owl")).not.toBeInTheDocument();
});

it("does not repeat an achievement after the provider remounts", () => {
   const first = renderHook(useToast, { wrapper });
   act(() => first.result.current.addToast(toast));
   first.unmount();
   const second = renderHook(useToast, { wrapper });
   act(() => second.result.current.addToast(toast));
   expect(screen.queryByText("Night Owl")).not.toBeInTheDocument();
});

it("does not announce a lower tier when win rate falls below a previously seen tier", () => {
   localStorage.setItem(
      "hearts_seen_achievements_alice",
      JSON.stringify(["consistent_gold"])
   );
   const { result } = renderHook(useToast, { wrapper });
   act(() =>
      result.current.addToasts([
         { ...toast, achievementId: "consistent_silver", name: "Sharp" },
      ])
   );
   act(() => vi.advanceTimersByTime(1));
   expect(screen.queryByText("Sharp")).not.toBeInTheDocument();
});

it("automatically dismisses after three seconds without pressing the dismiss button", () => {
   const { result } = renderHook(useToast, { wrapper });
   act(() => result.current.addToast(toast));
   act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
   expect(
      screen.getByRole("button", {
         name: "Dismiss Night Owl achievement notification",
      })
   ).toBeEnabled();
   act(() => vi.advanceTimersByTime(1));
   expect(
      screen.getByRole("button", {
         name: "Dismiss Night Owl achievement notification",
      })
   ).toBeDisabled();
   act(() => vi.advanceTimersByTime(TOAST_EXIT_MS));
   expect(screen.queryByText("Night Owl")).not.toBeInTheDocument();
   expect(vi.getTimerCount()).toBe(0);
});

it("dismisses a toast early with the x and clears its pending timeout", () => {
   const { result } = renderHook(useToast, { wrapper });
   act(() => result.current.addToast(toast));
   act(() => vi.advanceTimersByTime(1000));
   fireEvent.click(
      screen.getByRole("button", {
         name: "Dismiss Night Owl achievement notification",
      })
   );
   act(() => vi.advanceTimersByTime(TOAST_EXIT_MS));
   expect(screen.queryByText("Night Owl")).not.toBeInTheDocument();
   expect(vi.getTimerCount()).toBe(0);
   act(() => result.current.addToast(toast));
   expect(screen.queryByText("Night Owl")).not.toBeInTheDocument();
});

it("does not reset another toast's automatic timeout when one is dismissed", () => {
   const { result } = renderHook(useToast, { wrapper });
   act(() => {
      result.current.addToast(toast);
      result.current.addToast({
         achievementId: "geezer",
         name: "Geezer",
         icon: "music",
      });
   });
   act(() => vi.advanceTimersByTime(1000));
   fireEvent.click(
      screen.getByRole("button", {
         name: "Dismiss Night Owl achievement notification",
      })
   );
   act(() => vi.advanceTimersByTime(TOAST_EXIT_MS));
   expect(screen.queryByText("Night Owl")).not.toBeInTheDocument();
   expect(screen.getByText("Geezer")).toBeInTheDocument();
   act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1000));
   expect(screen.queryByText("Geezer")).not.toBeInTheDocument();
   expect(vi.getTimerCount()).toBe(0);
});

it.each(["single", "batch"])(
   "shows all queued achievements from %s notifications with at most three visible at once",
   (mode) => {
      const { result } = renderHook(useToast, { wrapper });
      const awards = Array.from({ length: 5 }, (_, index) => ({
         achievementId: `award-${index}`,
         name: `Award ${index}`,
         icon: "star",
      }));
      act(() => {
         if (mode === "batch") result.current.addToasts(awards);
         else awards.forEach((award) => result.current.addToast(award));
      });
      const displayed = new Set<string>();
      for (let elapsed = 0; elapsed < 12000; elapsed += 100) {
         act(() => vi.advanceTimersByTime(100));
         const buttons = screen.queryAllByRole("button");
         expect(buttons.length).toBeLessThanOrEqual(3);
         buttons.forEach((button) =>
            displayed.add(button.getAttribute("aria-label")!)
         );
      }
      expect([...displayed]).toEqual(
         expect.arrayContaining(
            Array.from(
               { length: 5 },
               (_, index) => `Dismiss Award ${index} achievement notification`
            )
         )
      );
      expect(vi.getTimerCount()).toBe(0);
   }
);

it("clears visible and pending toasts on account changes and rejects stale callbacks", () => {
   const { result, rerender } = renderHook(useToast, { wrapper });
   const oldAddToast = result.current.addToast;
   act(() =>
      result.current.addToasts([
         toast,
         { achievementId: "geezer", name: "Geezer", icon: "music" },
      ])
   );
   act(() => vi.advanceTimersByTime(1));
   expect(screen.getByText("Night Owl")).toBeInTheDocument();
   auth.user = { id: "bob" };
   rerender();
   expect(screen.queryByText("Night Owl")).not.toBeInTheDocument();
   act(() => vi.advanceTimersByTime(TOAST_STAGGER_MS));
   expect(screen.queryByText("Geezer")).not.toBeInTheDocument();
   act(() =>
      oldAddToast({ ...toast, achievementId: "early_bird", name: "Early Bird" })
   );
   expect(screen.queryByText("Early Bird")).not.toBeInTheDocument();
   act(() => result.current.addToast(toast));
   expect(screen.getByText("Night Owl")).toBeInTheDocument();
   expect(
      JSON.parse(localStorage.getItem("hearts_seen_achievements_bob")!)
   ).toContain("night_owl");
   auth.user = { id: "alice" };
   rerender();
   act(() =>
      oldAddToast({ ...toast, achievementId: "early_bird", name: "Early Bird" })
   );
   expect(screen.queryByText("Early Bird")).not.toBeInTheDocument();
});

it("still shows and deduplicates game achievements when browser storage is blocked", () => {
   vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
   });
   vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
   });
   const { result } = renderHook(useToast, { wrapper });
   act(() => result.current.addToast(toast));
   expect(screen.getByText("Night Owl")).toBeInTheDocument();
   act(() => vi.advanceTimersByTime(TOAST_DURATION_MS + TOAST_EXIT_MS));
   act(() => result.current.addToast(toast));
   expect(screen.queryByText("Night Owl")).not.toBeInTheDocument();
});
