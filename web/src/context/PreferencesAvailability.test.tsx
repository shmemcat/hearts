import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthContext } from "./AuthContext";
import { CardStyleProvider, useCardStyle } from "./CardStyleContext";
import { HardLevelProvider, useHardLevel } from "./HardLevelContext";
import { MobileLayoutProvider, useMobileLayout } from "./MobileLayoutContext";
import {
   CARD_STYLE_KEY,
   HARD_LEVEL_KEY,
   MOBILE_LAYOUT_KEY,
   STORAGE_KEY,
} from "@/lib/constants";

beforeEach(() => {
   localStorage.clear();
   localStorage.setItem(STORAGE_KEY, "legacy-credential");
   localStorage.setItem(CARD_STYLE_KEY, "flourish");
   localStorage.setItem(HARD_LEVEL_KEY, "harder");
   localStorage.setItem(MOBILE_LAYOUT_KEY, "double");
   vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

it("keeps browser preferences without uploading them during a preference-service outage", () => {
   function wrapper({ children }: { children: React.ReactNode }) {
      return (
         <AuthContext.Provider
            value={{
               user: { id: "42", email: "test@example.test" },
               token: "legacy-credential",
               status: "authenticated",
               preferences: null,
               preferencesAvailable: false,
               login: async () => ({}),
               logout: () => {},
               updateUser: () => {},
            }}
         >
            <CardStyleProvider>
               <HardLevelProvider>
                  <MobileLayoutProvider>{children}</MobileLayoutProvider>
               </HardLevelProvider>
            </CardStyleProvider>
         </AuthContext.Provider>
      );
   }
   const { result } = renderHook(
      () => ({
         card: useCardStyle(),
         hard: useHardLevel(),
         layout: useMobileLayout(),
      }),
      { wrapper }
   );
   expect(result.current.card.cardStyle).toBe("flourish");
   expect(result.current.hard.hardLevel).toBe("harder");
   expect(result.current.layout.mobileLayout).toBe("double");
   expect(fetch).not.toHaveBeenCalled();
});
