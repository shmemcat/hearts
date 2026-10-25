import type { GameTurnSoundOptions } from "@/lib/turnSound";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
   TurnSoundProvider,
   TurnSoundOption,
   useTurnIndicator,
} from "./TurnSoundContext";

const mocks = vi.hoisted(() => ({
   auth: {
      user: null as null | {
         id: string;
         turn_sound?: Partial<Record<"golf" | "euchre" | "hearts", boolean>>;
         turn_sound_options?: GameTurnSoundOptions;
      },
      loading: false,
      status: "unauthenticated",
      updateProfile: vi.fn(),
      updateUser: vi.fn(),
   },
   play: vi.fn(),
   stop: vi.fn(),
   setVolume: vi.fn(),
   save: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/turnSound", async (original) => ({
   ...(await original<typeof import("@/lib/turnSound")>()),
   createTurnSoundPlayer: () => ({
      play: mocks.play,
      stop: mocks.stop,
      setVolume: mocks.setVolume,
   }),
}));
vi.mock("@/lib/sharedAccount", () => ({ sharedAccountRequest: mocks.save }));

function Harness({ ready = true, decision = "game:1:turn:1" }) {
   useTurnIndicator(ready, decision);
   return <TurnSoundOption />;
}
const view = (ready = true, decision = "game:1:turn:1") => (
   <TurnSoundProvider>
      <Harness ready={ready} decision={decision} />
   </TurnSoundProvider>
);
beforeEach(() => {
   vi.clearAllMocks();
   mocks.auth.updateProfile.mockReset();
   mocks.save.mockReset().mockResolvedValue({ user: null });
   mocks.auth.user = null;
   mocks.auth.loading = false;
   mocks.auth.status = "unauthenticated";
});

it("keeps guests and accounts without an explicit opt-in silent", () => {
   const page = render(view());
   expect(screen.getByRole("checkbox")).not.toBeChecked();
   expect(screen.getByRole("checkbox")).toBeDisabled();
   mocks.auth.user = { id: "new-account" };
   mocks.auth.status = "authenticated";
   page.rerender(view());
   expect(screen.getByRole("checkbox")).toBeEnabled();
   expect(screen.getByRole("checkbox")).not.toBeChecked();
   expect(mocks.play).not.toHaveBeenCalled();
});

it("waits for input to unlock, chimes once per decision, and handles consecutive turns", () => {
   mocks.auth.user = { id: "player", turn_sound: { hearts: true } };
   mocks.auth.status = "authenticated";
   const page = render(view(false));
   expect(mocks.play).not.toHaveBeenCalled();
   page.rerender(view(true));
   expect(mocks.play).toHaveBeenCalledExactlyOnceWith("pop", 0.15);
   page.rerender(view(true));
   page.rerender(view(false));
   page.rerender(view(true));
   expect(mocks.play).toHaveBeenCalledTimes(1);
   page.rerender(view(true, "game:1:turn:2"));
   expect(mocks.play).toHaveBeenCalledTimes(2);
});

it("does not inherit the previous account's opt-in or another game's opt-in", () => {
   mocks.auth.user = { id: "player", turn_sound: { hearts: true } };
   mocks.auth.status = "authenticated";
   const page = render(view());
   expect(mocks.play).toHaveBeenCalledTimes(1);
   mocks.auth.user = { id: "other", turn_sound: { golf: true } };
   page.rerender(view(true, "game:1:turn:2"));
   expect(screen.getByRole("checkbox")).not.toBeChecked();
   mocks.auth.user = null;
   mocks.auth.status = "unauthenticated";
   page.rerender(view(true, "game:1:turn:3"));
   expect(mocks.play).toHaveBeenCalledTimes(1);
});

it("does not play when loading or when disabling the option", () => {
   mocks.auth.user = { id: "player", turn_sound: { hearts: true } };
   mocks.auth.loading = true;
   mocks.auth.status = "loading";
   const page = render(view());
   expect(screen.getByRole("checkbox")).not.toBeChecked();
   expect(mocks.play).not.toHaveBeenCalled();
   mocks.auth.loading = false;
   mocks.auth.status = "authenticated";
   mocks.auth.user = { id: "player", turn_sound: { hearts: false } };
   page.rerender(view(true, "game:1:turn:2"));
   expect(mocks.play).not.toHaveBeenCalled();
});

it("saves only an explicit opt-in and displays failures without enabling it", async () => {
   mocks.auth.user = { id: "player" };
   mocks.auth.status = "authenticated";
   mocks.save.mockRejectedValueOnce(new Error("Unable to save your option."));
   render(view());
   await act(async () => fireEvent.click(screen.getByRole("checkbox")));
   expect(mocks.save).toHaveBeenCalledWith(
      "profile",
      { turn_sound: { game: "hearts", enabled: true } },
      "player"
   );
   expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to save your option."
   );
   expect(screen.getByRole("checkbox")).not.toBeChecked();
   expect(mocks.play).not.toHaveBeenCalled();
});

it("checks immediately while saving quietly and rolls back if saving fails", async () => {
   mocks.auth.user = { id: "player" };
   mocks.auth.status = "authenticated";
   let rejectSave!: (reason: Error) => void;
   mocks.save.mockImplementationOnce(
      () =>
         new Promise((_resolve, reject) => {
            rejectSave = reject;
         })
   );
   render(view(false));
   fireEvent.click(screen.getByRole("checkbox"));
   expect(screen.getByRole("checkbox")).toBeChecked();
   expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
   expect(
      screen.queryByText("Off by default. Uses your sound effects volume.")
   ).not.toBeInTheDocument();
   await act(async () => rejectSave(new Error("Unable to save your option.")));
   expect(screen.getByRole("checkbox")).not.toBeChecked();
   expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to save your option."
   );
});

it("shows only the opt-in until checked, then exposes the four sounds without extra labels", async () => {
   mocks.auth.user = { id: "player" };
   mocks.auth.status = "authenticated";
   render(view(false));
   expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
   expect(screen.queryByRole("slider")).not.toBeInTheDocument();
   expect(
      screen.queryByRole("button", { name: "Preview sound" })
   ).not.toBeInTheDocument();
   await act(async () => fireEvent.click(screen.getByRole("checkbox")));
   expect(
      screen.getByRole("combobox", { name: "Turn indicator sound" })
   ).toHaveValue("pop");
   expect(
      screen.getAllByRole("option").map((option) => option.textContent)
   ).toEqual(["Pop", "Chime", "Ding", "Notification"]);
   expect(
      screen.getByRole("slider", { name: "Turn sound volume" })
   ).toHaveValue("15");
   expect(screen.queryByText(/^Sound$/)).not.toBeInTheDocument();
   expect(screen.queryByText("Your current sound")).not.toBeInTheDocument();
   expect(mocks.play).not.toHaveBeenCalled();
   await act(async () => fireEvent.click(screen.getByRole("checkbox")));
   expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
   expect(screen.queryByRole("slider")).not.toBeInTheDocument();
});

it("saves the selected sound and independent volume, and previews without saving", async () => {
   mocks.auth.user = { id: "player", turn_sound: { hearts: true } };
   mocks.auth.status = "authenticated";
   render(view(false));
   await act(async () =>
      fireEvent.change(screen.getByRole("combobox"), {
         target: { value: "notification" },
      })
   );
   expect(mocks.save).toHaveBeenLastCalledWith(
      "profile",
      { turn_sound: { game: "hearts", sound: "notification" } },
      "player"
   );
   expect(mocks.play).not.toHaveBeenCalled();
   mocks.save.mockClear();
   fireEvent.change(screen.getByRole("slider"), { target: { value: "81" } });
   expect(screen.getByText("81%")).toBeInTheDocument();
   expect(mocks.save).not.toHaveBeenCalled();
   await act(async () => fireEvent.pointerUp(screen.getByRole("slider")));
   expect(mocks.save).toHaveBeenLastCalledWith(
      "profile",
      { turn_sound: { game: "hearts", volume: 0.81 } },
      "player"
   );
   mocks.save.mockClear();
   fireEvent.click(screen.getByRole("button", { name: "Preview sound" }));
   expect(mocks.play).toHaveBeenCalledWith(
      "notification",
      0.81,
      expect.any(Function),
      expect.any(Function)
   );
   expect(mocks.save).not.toHaveBeenCalled();
   expect(screen.getByRole("checkbox")).toBeChecked();
});

it("rolls back a rejected sound choice and preserves saved choices when disabled", async () => {
   mocks.auth.user = {
      id: "player",
      turn_sound: { hearts: true },
      turn_sound_options: { hearts: { sound: "ding", volume: 0.4 } },
   };
   mocks.auth.status = "authenticated";
   mocks.save.mockRejectedValueOnce(new Error("Save failed"));
   render(view(false));
   await act(async () =>
      fireEvent.change(screen.getByRole("combobox"), {
         target: { value: "chime" },
      })
   );
   expect(screen.getByRole("combobox")).toHaveValue("ding");
   expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
   await act(async () => fireEvent.click(screen.getByRole("checkbox")));
   expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
   await act(async () => fireEvent.click(screen.getByRole("checkbox")));
   expect(screen.getByRole("combobox")).toHaveValue("ding");
   expect(screen.getByRole("slider")).toHaveValue("40");
});

it("uses saved sound and volume for actual turns without replaying after option changes", async () => {
   mocks.auth.user = {
      id: "player",
      turn_sound: { hearts: true },
      turn_sound_options: { hearts: { sound: "chime", volume: 0.85 } },
   };
   mocks.auth.status = "authenticated";
   const page = render(view());
   expect(mocks.play).toHaveBeenCalledExactlyOnceWith("chime", 0.85);
   await act(async () =>
      fireEvent.change(screen.getByRole("combobox"), {
         target: { value: "ding" },
      })
   );
   expect(mocks.play).toHaveBeenCalledTimes(1);
   page.rerender(view(true, "game:1:turn:2"));
   expect(mocks.play).toHaveBeenLastCalledWith("ding", 0.85);
   expect(mocks.play).toHaveBeenCalledTimes(2);
});

it("keeps zero-volume turn alerts silent and does not leak another account's choices", () => {
   mocks.auth.user = {
      id: "player",
      turn_sound: { hearts: true },
      turn_sound_options: { hearts: { sound: "notification", volume: 0 } },
   };
   mocks.auth.status = "authenticated";
   const page = render(view());
   expect(mocks.play).not.toHaveBeenCalled();
   mocks.auth.user = { id: "different", turn_sound: { hearts: true } };
   page.rerender(view(false));
   expect(screen.getByRole("combobox")).toHaveValue("pop");
   expect(screen.getByRole("slider")).toHaveValue("15");
});
