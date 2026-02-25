import { render, screen } from "@testing-library/react";
import { InfoPill } from "./InfoPill";

describe("InfoPill", () => {
   it("displays round number", () => {
      render(<InfoPill round={3} passDirection="left" difficulty="easy" />);
      expect(screen.getByText("Round 3")).toBeInTheDocument();
   });

   it("displays pass direction", () => {
      render(<InfoPill round={1} passDirection="right" difficulty="medium" />);
      expect(screen.getByText("Pass right")).toBeInTheDocument();
   });

   it("displays 'No pass' when direction is none", () => {
      render(<InfoPill round={4} passDirection="none" difficulty="easy" />);
      expect(screen.getByText("No pass")).toBeInTheDocument();
   });

   it("displays difficulty label", () => {
      render(<InfoPill round={1} passDirection="left" difficulty="medium" />);
      expect(screen.getByText("Medium")).toBeInTheDocument();
   });

   it("displays hard difficulty labels", () => {
      render(<InfoPill round={2} passDirection="across" difficulty="harder" />);
      expect(screen.getByText("Harder")).toBeInTheDocument();
   });

   it("hides difficulty when not provided", () => {
      const { container } = render(<InfoPill round={1} passDirection="left" />);
      expect(container.querySelector("[class*=Difficulty]")).toBeNull();
   });

   it("displays 'Pass across'", () => {
      render(<InfoPill round={3} passDirection="across" difficulty="easy" />);
      expect(screen.getByText("Pass across")).toBeInTheDocument();
   });

   it("displays 'Pass left'", () => {
      render(<InfoPill round={1} passDirection="left" difficulty="easy" />);
      expect(screen.getByText("Pass left")).toBeInTheDocument();
   });
});
