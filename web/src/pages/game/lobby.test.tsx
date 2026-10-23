import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, expect, it, vi } from "vitest";
import LobbyPage from "./lobby";
import type {
   LobbyState,
   LobbySessionEvent,
   JoinAckEvent,
} from "@/types/lobby";

const mocks = vi.hoisted(() => ({
   update: null as ((state: LobbyState) => void) | null,
   session: null as ((event: LobbySessionEvent) => void) | null,
   joined: null as ((event: JoinAckEvent) => void) | null,
   closed: null as (() => void) | null,
   disconnected: null as (() => void) | null,
   error: null as ((message: string) => void) | null,
   getLobbyState: vi.fn(),
   connect: vi.fn(),
   disconnect: vi.fn(),
   close: vi.fn(),
   sound: vi.fn(),
}));

vi.mock("@/lib/lobbyApi", () => ({ getLobbyState: mocks.getLobbyState }));
vi.mock("@/lib/lobbySocket", () => ({
   connectLobby: mocks.connect,
   disconnect: mocks.disconnect,
   sendCloseLobby: mocks.close,
   sendJoin: vi.fn(),
   sendLeave: vi.fn(),
   sendStartGame: vi.fn(),
   onLobbyUpdate: (cb: typeof mocks.update) => {
      mocks.update = cb;
      return vi.fn();
   },
   onLobbySession: (cb: typeof mocks.session) => {
      mocks.session = cb;
      return vi.fn();
   },
   onJoinAck: (cb: typeof mocks.joined) => {
      mocks.joined = cb;
      return vi.fn();
   },
   onLobbyClosed: (cb: typeof mocks.closed) => {
      mocks.closed = cb;
      return vi.fn();
   },
   onDisconnect: (cb: typeof mocks.disconnected) => {
      mocks.disconnected = cb;
      return vi.fn();
   },
   onError: (cb: typeof mocks.error) => {
      mocks.error = cb;
      return vi.fn();
   },
   onGameStarted: vi.fn(() => vi.fn()),
}));
vi.mock("@/context/AuthContext", () => ({
   useAuth: () => ({ user: null }),
}));
vi.mock("@/context/SoundContext", () => ({
   useSound: () => ({ play: mocks.sound }),
}));
vi.mock("@/components/Navbar", () => ({ triggerLogoFadeOut: vi.fn() }));
vi.mock("@/components/ui", () => ({
   PageLayout: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   ButtonGroup: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
}));

const tokenKey = "hearts_lobby_token_ABC123";
const lobby: LobbyState = {
   code: "ABC123",
   host_token: "host-token",
   status: "waiting",
   game_id: null,
   seats: [
      { index: 0, status: "human", name: "Host" },
      { index: 1, status: "empty" },
      { index: 2, status: "empty" },
      { index: 3, status: "empty" },
   ],
};

function renderLobby() {
   return render(
      <HelmetProvider>
         <MemoryRouter initialEntries={["/game/lobby/ABC123"]}>
            <Routes>
               <Route path="/game/lobby/:code" element={<LobbyPage />} />
            </Routes>
         </MemoryRouter>
      </HelmetProvider>
   );
}

beforeEach(() => {
   vi.clearAllMocks();
   localStorage.setItem(tokenKey, "host-token");
   mocks.getLobbyState.mockResolvedValue({ ok: true, data: lobby });
});

it("restores host controls after leaving and returning", async () => {
   const first = renderLobby();
   await screen.findByDisplayValue("ABC123");
   expect(screen.queryByRole("button", { name: "Close Lobby" })).toBeNull();
   act(() => mocks.session?.({ player_token: "host-token", seat_index: 0 }));
   expect(
      screen.getByRole("button", { name: "Close Lobby" })
   ).toBeInTheDocument();
   first.unmount();
   expect(mocks.disconnect).toHaveBeenCalledOnce();

   renderLobby();
   await screen.findByDisplayValue("ABC123");
   expect(mocks.connect).toHaveBeenLastCalledWith("ABC123", "host-token");
   act(() => mocks.session?.({ player_token: "host-token", seat_index: 0 }));
   fireEvent.click(screen.getByRole("button", { name: "Close Lobby" }));

   expect(mocks.close).toHaveBeenCalledOnce();
   expect(localStorage.getItem(tokenKey)).toBe("host-token");
   act(() => mocks.closed?.());
   expect(screen.getByText("Lobby has been closed.")).toBeInTheDocument();
   expect(localStorage.getItem(tokenKey)).toBeNull();
});

it("preserves the host token after a rejected close so the host can retry", async () => {
   renderLobby();
   await screen.findByDisplayValue("ABC123");
   act(() => mocks.session?.({ player_token: "host-token", seat_index: 0 }));
   fireEvent.click(screen.getByRole("button", { name: "Close Lobby" }));
   act(() => mocks.error?.("Only the host can close the lobby"));

   expect(screen.getByRole("alert")).toHaveTextContent("Only the host");
   expect(localStorage.getItem(tokenKey)).toBe("host-token");
   fireEvent.click(screen.getByRole("button", { name: "Close Lobby" }));
   expect(mocks.close).toHaveBeenCalledTimes(2);
   expect(screen.queryByRole("alert")).toBeNull();
});

it("waits for fresh confirmation after a connection drops without losing the token", async () => {
   renderLobby();
   await screen.findByDisplayValue("ABC123");
   act(() => mocks.session?.({ player_token: "host-token", seat_index: 0 }));
   act(() => mocks.disconnected?.());
   expect(screen.queryByRole("button", { name: "Close Lobby" })).toBeNull();
   expect(localStorage.getItem(tokenKey)).toBe("host-token");

   act(() => mocks.session?.({ player_token: "host-token", seat_index: 0 }));
   expect(
      screen.getByRole("button", { name: "Close Lobby" })
   ).toBeInTheDocument();
});

it("clears an invalid saved seat and lets the visitor join again", async () => {
   renderLobby();
   await screen.findByDisplayValue("ABC123");
   act(() => mocks.session?.({ player_token: null, seat_index: null }));

   expect(localStorage.getItem(tokenKey)).toBeNull();
   expect(screen.queryByRole("button", { name: "Close Lobby" })).toBeNull();
   expect(
      screen.getAllByRole("button", { name: /Select\s*Seat/ })
   ).toHaveLength(3);
});

it("keeps the existing connection when a seat is assigned", async () => {
   localStorage.removeItem(tokenKey);
   renderLobby();
   await screen.findByPlaceholderText("Your name");
   act(() => mocks.joined?.({ player_token: "guest-token", seat_index: 2 }));

   expect(localStorage.getItem(tokenKey)).toBe("guest-token");
   expect(mocks.connect).toHaveBeenCalledOnce();
   expect(mocks.disconnect).not.toHaveBeenCalled();
   expect(
      screen.getByRole("button", { name: "Leave Lobby" })
   ).toBeInTheDocument();
});

it("keeps newer socket state when the initial request arrives late", async () => {
   let finishRequest!: (result: { ok: true; data: LobbyState }) => void;
   mocks.getLobbyState.mockReturnValue(
      new Promise((resolve) => {
         finishRequest = resolve;
      })
   );
   renderLobby();
   act(() => {
      mocks.session?.({ player_token: "host-token", seat_index: 0 });
      mocks.update?.({ ...lobby, host_token: "new-host" });
   });
   await act(async () => finishRequest({ ok: true, data: lobby }));

   expect(screen.queryByRole("button", { name: "Close Lobby" })).toBeNull();
   expect(
      screen.getByRole("button", { name: "Leave Lobby" })
   ).toBeInTheDocument();
});

it("shows a finished lobby as closed instead of offering stale host controls", async () => {
   mocks.getLobbyState.mockResolvedValue({
      ok: true,
      data: { ...lobby, status: "finished" },
   });
   renderLobby();

   expect(
      await screen.findByText("Lobby has been closed.")
   ).toBeInTheDocument();
   expect(screen.queryByRole("button", { name: "Close Lobby" })).toBeNull();
});
