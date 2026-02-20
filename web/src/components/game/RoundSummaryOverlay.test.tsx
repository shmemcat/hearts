import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { RoundSummaryOverlay, type RoundSummaryData } from "./RoundSummaryOverlay";

const summary: RoundSummaryData = {
   round: 2,
   deltas: [5, 10, 0, 11],
   players: [
      { name: "You", score: 15 },
      { name: "Alice", score: 20 },
      { name: "Bob", score: 5 },
      { name: "Carol", score: 31 },
   ],
};

describe("RoundSummaryOverlay", () => {
   it("displays round number", () => {
      render(
         <RoundSummaryOverlay summary={summary} onContinue={vi.fn()} />
      );
      expect(screen.getByText("Round 2 Complete")).toBeInTheDocument();
   });

   it("sorts players by total score ascending", () => {
      render(
         <RoundSummaryOverlay summary={summary} onContinue={vi.fn()} />
      );
      const rows = screen.getAllByRole("row").slice(1);
      const names = rows.map((r) => r.cells[0].textContent);
      expect(names).toEqual(["Bob", "You", "Alice", "Carol"]);
   });

   it("displays delta with + prefix for positive values", () => {
      render(
         <RoundSummaryOverlay summary={summary} onContinue={vi.fn()} />
      );
      expect(screen.getByText("+5")).toBeInTheDocument();
      expect(screen.getByText("+10")).toBeInTheDocument();
      expect(screen.getByText("+11")).toBeInTheDocument();
   });

   it("displays 0 for zero deltas", () => {
      render(
         <RoundSummaryOverlay summary={summary} onContinue={vi.fn()} />
      );
      expect(screen.getByText("0")).toBeInTheDocument();
   });

   it("displays total scores", () => {
      render(
         <RoundSummaryOverlay summary={summary} onContinue={vi.fn()} />
      );
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("31")).toBeInTheDocument();
   });

   it("clicking Continue calls onContinue", async () => {
      const user = userEvent.setup();
      const onContinue = vi.fn();
      render(
         <RoundSummaryOverlay summary={summary} onContinue={onContinue} />
      );
      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(onContinue).toHaveBeenCalled();
   });
});
