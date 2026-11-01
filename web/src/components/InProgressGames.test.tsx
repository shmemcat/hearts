import {
   cleanup,
   fireEvent,
   render,
   screen,
   waitFor,
   within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InProgressGames, type SavedGameCard } from "./InProgressGames";
afterEach(cleanup);
const games: SavedGameCard[] = [
   {
      id: "first",
      title: "First game",
      mode: "Bots",
      progress: "Round 2",
      status: "Ready to resume",
      multiplayer: false,
   },
   {
      id: "second",
      title: "Second game",
      mode: "Multiplayer",
      progress: "Round 3",
      status: "Your turn",
      multiplayer: true,
   },
];
it("shows every game with adjacent primary Resume and secondary Concede buttons, without an automatic popup", () => {
   render(
      <InProgressGames games={games} onResume={vi.fn()} onConcede={vi.fn()} />
   );
   expect(screen.getAllByRole("article")).toHaveLength(2);
   expect(screen.queryByRole("dialog")).toBeNull();
   for (const game of games) {
      const card = within(screen.getByRole("article", { name: game.title }));
      const resume = card.getByRole("button", { name: "Resume" });
      const concede = card.getByRole("button", { name: "Concede" });
      expect(resume.className).not.toContain("secondary");
      expect(concede.className).toContain("secondary");
      expect(resume.nextElementSibling).toBe(concede);
   }
});
it("resumes the selected game and confirms a concession only for that game", async () => {
   const resume = vi.fn(),
      concede = vi.fn();
   render(
      <InProgressGames games={games} onResume={resume} onConcede={concede} />
   );
   const card = within(screen.getByRole("article", { name: "Second game" }));
   fireEvent.click(card.getByRole("button", { name: "Resume" }));
   await waitFor(() => expect(resume).toHaveBeenCalledWith("second"));
   await waitFor(() =>
      expect(
         (card.getByRole("button", { name: "Concede" }) as HTMLButtonElement)
            .disabled
      ).toBe(false)
   );
   fireEvent.click(card.getByRole("button", { name: "Concede" }));
   expect(concede).not.toHaveBeenCalled();
   fireEvent.click(card.getByRole("button", { name: "Keep game" }));
   expect(concede).not.toHaveBeenCalled();
   fireEvent.click(card.getByRole("button", { name: "Concede" }));
   fireEvent.click(card.getByRole("button", { name: "Concede" }));
   await waitFor(() =>
      expect(concede).toHaveBeenCalledExactlyOnceWith("second")
   );
});
it("keeps games visible and reports a failed concession", async () => {
   render(
      <InProgressGames
         games={games}
         onResume={vi.fn()}
         onConcede={vi
            .fn()
            .mockRejectedValue(new Error("Reconnect before conceding."))}
      />
   );
   const card = within(screen.getByRole("article", { name: "First game" }));
   fireEvent.click(card.getByRole("button", { name: "Concede" }));
   fireEvent.click(card.getByRole("button", { name: "Concede" }));
   await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Reconnect")
   );
   expect(screen.getAllByRole("article")).toHaveLength(2);
});
it("omits the section when there are no unfinished games", () => {
   const { container } = render(
      <InProgressGames games={[]} onResume={vi.fn()} onConcede={vi.fn()} />
   );
   expect(container.childElementCount).toBe(0);
});
