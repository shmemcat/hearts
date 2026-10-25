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
      },
      loading: false,
      status: "unauthenticated",
      updateProfile: vi.fn(),
      updateUser: vi.fn(),
   },
   play: vi.fn(),
   save: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/context/SoundContext", () => ({
   useSound: () => ({ play: mocks.play }),
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
   expect(mocks.play).toHaveBeenCalledExactlyOnceWith("turn");
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
