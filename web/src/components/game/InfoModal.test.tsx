import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { InfoModal, InfoButton } from "./InfoModal";

const players = [
   { name: "You", score: 10 },
   { name: "Alice", score: 5 },
   { name: "Bob", score: 20 },
   { name: "Carol", score: 15 },
];

describe("InfoModal", () => {
   it("displays round number", () => {
      render(
         <InfoModal
            round={3}
            passDirection="left"
            phase="playing"
            players={players}
            onClose={vi.fn()}
         />
      );
      expect(screen.getByText("Round 3")).toBeInTheDocument();
   });

   it("displays pass direction", () => {
      render(
         <InfoModal
            round={1}
            passDirection="right"
            phase="playing"
            players={players}
            onClose={vi.fn()}
         />
      );
      expect(screen.getByText("Pass right")).toBeInTheDocument();
   });

   it("displays 'No pass' for none direction", () => {
      render(
         <InfoModal
            round={4}
            passDirection="none"
            phase="playing"
            players={players}
            onClose={vi.fn()}
         />
      );
      expect(screen.getByText("No pass")).toBeInTheDocument();
   });

   it("sorts players by score (ascending)", () => {
      render(
         <InfoModal
            round={1}
            passDirection="left"
            phase="playing"
            players={players}
            onClose={vi.fn()}
         />
      );
      const rows = screen.getAllByRole("row").slice(1); // skip header
      const names = rows.map((r) => r.cells[0].textContent);
      expect(names).toEqual(["Alice", "You", "Carol", "Bob"]);
   });

   it("clicking Close calls onClose", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
         <InfoModal
            round={1}
            passDirection="left"
            phase="playing"
            players={players}
            onClose={onClose}
         />
      );
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(onClose).toHaveBeenCalled();
   });

   it("shows concede button when onConcede provided and not gameOver", () => {
      render(
         <InfoModal
            round={1}
            passDirection="left"
            phase="playing"
            players={players}
            onClose={vi.fn()}
            onConcede={vi.fn()}
         />
      );
      expect(
         screen.getByRole("button", { name: "Concede Game" })
      ).toBeInTheDocument();
   });

   it("hides concede button when gameOver", () => {
      render(
         <InfoModal
            round={1}
            passDirection="left"
            phase="playing"
            players={players}
            onClose={vi.fn()}
            onConcede={vi.fn()}
            gameOver
         />
      );
      expect(
         screen.queryByRole("button", { name: "Concede Game" })
      ).not.toBeInTheDocument();
   });

   it("hides concede button when onConcede not provided", () => {
      render(
         <InfoModal
            round={1}
            passDirection="left"
            phase="playing"
            players={players}
            onClose={vi.fn()}
         />
      );
      expect(
         screen.queryByRole("button", { name: "Concede Game" })
      ).not.toBeInTheDocument();
   });
});

describe("InfoButton", () => {
   it("renders with round info aria-label", () => {
      render(<InfoButton onClick={vi.fn()} />);
      expect(
         screen.getByRole("button", { name: "Round info" })
      ).toBeInTheDocument();
   });

   it("fires onClick", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<InfoButton onClick={onClick} />);
      await user.click(screen.getByRole("button"));
      expect(onClick).toHaveBeenCalled();
   });
});
