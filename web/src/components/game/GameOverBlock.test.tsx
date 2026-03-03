import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GameOverBlock } from "./GameOverBlock";

const players = [
   { name: "You", score: 30, card_count: 0 },
   { name: "Alice", score: 45, card_count: 0 },
   { name: "Bob", score: 10, card_count: 0 },
   { name: "Carol", score: 60, card_count: 0 },
];

const tiedPlayers = [
   { name: "You", score: 10, card_count: 0 },
   { name: "Alice", score: 10, card_count: 0 },
   { name: "Bob", score: 50, card_count: 0 },
   { name: "Carol", score: 60, card_count: 0 },
];

function renderGameOver(
   winnerIndex: number | null,
   customPlayers = players,
   mySeatIndex = 0
) {
   return render(
      <MemoryRouter>
         <GameOverBlock
            players={customPlayers}
            winnerIndex={winnerIndex}
            mySeatIndex={mySeatIndex}
         />
      </MemoryRouter>
   );
}

describe("GameOverBlock", () => {
   it("shows 'You won!' when the local player wins", () => {
      renderGameOver(0);
      expect(screen.getByText("You won!")).toBeInTheDocument();
   });

   it("shows 'You won!' for a non-zero mySeatIndex winner", () => {
      renderGameOver(2, players, 2);
      expect(screen.getByText("You won!")).toBeInTheDocument();
   });

   it("shows '[WinnerName] won!' when another player wins", () => {
      renderGameOver(2);
      expect(screen.getByText("Bob won!")).toBeInTheDocument();
   });

   it("shows 'Game Over' when winnerIndex is null", () => {
      renderGameOver(null);
      expect(screen.getByText("Game Over")).toBeInTheDocument();
   });

   it("shows 'It's a tie!' when winnerIndex is -1", () => {
      renderGameOver(-1, tiedPlayers);
      expect(screen.getByText("It's a tie!")).toBeInTheDocument();
   });

   it("does not show 'Game Over' on a tie", () => {
      renderGameOver(-1, tiedPlayers);
      expect(screen.queryByText("Game Over")).not.toBeInTheDocument();
   });

   it("highlights all tied players in score table", () => {
      renderGameOver(-1, tiedPlayers);
      const rows = screen.getAllByRole("row").slice(1);
      const highlightedNames = rows
         .filter((r) =>
            (r as HTMLElement).className.includes("scoreTableWinner")
         )
         .map((r) => (r as HTMLTableRowElement).cells[0].textContent?.trim());
      expect(highlightedNames).toContain("You");
      expect(highlightedNames).toContain("Alice");
      expect(highlightedNames).not.toContain("Bob");
      expect(highlightedNames).not.toContain("Carol");
   });

   it("highlights the user's own row", () => {
      renderGameOver(2);
      const rows = screen.getAllByRole("row").slice(1);
      const myRow = rows.find(
         (r) =>
            (r as HTMLTableRowElement).cells[0].textContent?.trim() === "You"
      );
      expect(myRow).toBeDefined();
      expect((myRow as HTMLElement).className).toContain("scoreTableMe");
   });

   it("highlights the user's own row in multiplayer with mySeatIndex", () => {
      renderGameOver(0, players, 2);
      const rows = screen.getAllByRole("row").slice(1);
      const myRow = rows.find(
         (r) =>
            (r as HTMLTableRowElement).cells[0].textContent?.trim() === "Bob"
      );
      expect(myRow).toBeDefined();
      expect((myRow as HTMLElement).className).toContain("scoreTableMe");
   });

   it("sorts players by score ascending", () => {
      renderGameOver(2);
      const rows = screen.getAllByRole("row").slice(1);
      const names = rows.map((r) =>
         (r as HTMLTableRowElement).cells[0].textContent?.trim()
      );
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

   it("renders custom children instead of default button", () => {
      render(
         <MemoryRouter>
            <GameOverBlock players={players} winnerIndex={2}>
               <button>Play Again</button>
               <button>Home</button>
            </GameOverBlock>
         </MemoryRouter>
      );
      expect(screen.getByText("Play Again")).toBeInTheDocument();
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(
         screen.queryByRole("button", { name: "Create New Game" })
      ).not.toBeInTheDocument();
   });

   it("renders terminated variant with custom title and subtitle", () => {
      render(
         <MemoryRouter>
            <GameOverBlock
               title="Game Terminated"
               subtitle="All players have left the game."
               players={players}
               mySeatIndex={0}
            >
               <button>Create New Game</button>
               <button>Home</button>
            </GameOverBlock>
         </MemoryRouter>
      );
      expect(screen.getByText("Game Terminated")).toBeInTheDocument();
      expect(
         screen.getByText("All players have left the game.")
      ).toBeInTheDocument();
      expect(screen.getByText("Create New Game")).toBeInTheDocument();
      expect(screen.getByText("Home")).toBeInTheDocument();
   });

   it("hides score table when players is empty in terminated mode", () => {
      render(
         <MemoryRouter>
            <GameOverBlock
               title="Game Terminated"
               subtitle="All players have left the game."
            />
         </MemoryRouter>
      );
      expect(screen.getByText("Game Terminated")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
   });
});
