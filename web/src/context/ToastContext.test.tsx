import { act, renderHook, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ToastProvider, useToast } from "./ToastContext";
import { TOAST_DURATION_MS, TOAST_EXIT_MS } from "@/lib/constants";

vi.mock("@/context/AuthContext", () => ({
   useAuth: () => ({ user: { id: "alice" } }),
}));
const toast = { achievementId: "night_owl", name: "Night Owl", icon: "moon" };
function wrapper({ children }: { children: React.ReactNode }) {
   return <ToastProvider>{children}</ToastProvider>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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
