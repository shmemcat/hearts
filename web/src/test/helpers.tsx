import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CardStyleProvider } from "@/context/CardStyleContext";
import { HardLevelProvider } from "@/context/HardLevelContext";
import { SoundProvider } from "@/context/SoundContext";
import type { GameState, PlayEvent, GamePlayer } from "@/types/game";

interface WrapperOptions {
   route?: string;
   /** Skip auth provider (for testing useAuth outside provider) */
   skipAuth?: boolean;
}

function createWrapper(options: WrapperOptions = {}) {
   const { route = "/", skipAuth = false } = options;

   return function AllProviders({ children }: { children: React.ReactNode }) {
      const core = (
         <HelmetProvider>
            <ThemeProvider>
               <CardStyleProvider>
                  <HardLevelProvider>
                     <SoundProvider>
                        <MemoryRouter initialEntries={[route]}>
                           {children}
                        </MemoryRouter>
                     </SoundProvider>
                  </HardLevelProvider>
               </CardStyleProvider>
            </ThemeProvider>
         </HelmetProvider>
      );
      if (skipAuth) return core;
      return <AuthProvider>{core}</AuthProvider>;
   };
}

export function renderWithProviders(
   ui: React.ReactElement,
   options?: WrapperOptions & Omit<RenderOptions, "wrapper">
) {
   const { route, skipAuth, ...renderOptions } = options ?? {};
   return render(ui, {
      wrapper: createWrapper({ route, skipAuth }),
      ...renderOptions,
   });
}

export function createMockGameState(
   overrides: Partial<GameState> = {}
): GameState {
   return {
      phase: "playing",
      round: 1,
      pass_direction: "left",
      players: [
         { name: "You", score: 0, card_count: 13 },
         { name: "Alice", score: 0, card_count: 13 },
         { name: "Bob", score: 0, card_count: 13 },
         { name: "Carol", score: 0, card_count: 13 },
      ],
      human_hand: ["2c", "5d", "Js", "Ah", "3c", "7h"],
      legal_plays: ["2c"],
      current_trick: [null, null, null, null],
      whose_turn: 0,
      hearts_broken: false,
      game_over: false,
      winner_index: null,
      human_moon_shots: 0,
      ...overrides,
   };
}

export function createMockPlayEvent(
   overrides: Partial<PlayEvent> = {}
): PlayEvent {
   return {
      player_index: 0,
      card: "2c",
      ...overrides,
   };
}

export function createMockPlayers(
   overrides: Partial<GamePlayer>[] = []
): GamePlayer[] {
   const defaults: GamePlayer[] = [
      { name: "You", score: 0, card_count: 13 },
      { name: "Alice", score: 10, card_count: 13 },
      { name: "Bob", score: 5, card_count: 13 },
      { name: "Carol", score: 20, card_count: 13 },
   ];
   return defaults.map((d, i) => ({ ...d, ...overrides[i] }));
}
