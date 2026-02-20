import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GameOverBlock } from "./GameOverBlock";

const players = [
   { name: "You", score: 30, card_count: 0 },
   { name: "Alice", score: 45, card_count: 0 },
   { name: "Bob", score: 10, card_count: 0 },
   { name: "Carol", score: 60, card_count: 0 },
];

function renderGameOver(winnerIndex: number | null) {
   return render(
      <MemoryRouter>
         <GameOverBlock players={players} winnerIndex={winnerIndex} />
      </MemoryRouter>
   );
}

describe("GameOverBlock", () => {
   it("shows 'You won!' when human wins", () => {
      renderGameOver(0);
      expect(screen.getByText("You won!")).toBeInTheDocument();
   });

   it("shows 'Game Over' when human loses", () => {
      renderGameOver(2);
      expect(screen.getByText("Game Over")).toBeInTheDocument();
   });

   it("shows 'Game Over' when winnerIndex is null", () => {
      renderGameOver(null);
      expect(screen.getByText("Game Over")).toBeInTheDocument();
   });

   it("sorts players by score ascending", () => {
      renderGameOver(2);
      const rows = screen.getAllByRole("row").slice(1);
      const names = rows.map((r) => r.cells[0].textContent);
      expect(names).toEqual(["Bob", "You", "Alice", "Carol"]);
   });

   it("displays all player scores", () => {
      renderGameOver(2);
      expect(screen.getByText("30")).toBeInTheDocument();
      expect(screen.getByText("45")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("60")).toBeInTheDocument();
   });

   it("renders Create New Game link", () => {
      renderGameOver(2);
      expect(
         screen.getByRole("button", { name: "Create New Game" })
      ).toBeInTheDocument();
   });
});
