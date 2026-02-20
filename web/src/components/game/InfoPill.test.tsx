import { render, screen } from "@testing-library/react";
import { InfoPill } from "./InfoPill";

describe("InfoPill", () => {
   it("displays round number", () => {
      render(<InfoPill round={3} passDirection="left" phase="passing" />);
      expect(screen.getByText("Round 3")).toBeInTheDocument();
   });

   it("displays pass direction", () => {
      render(<InfoPill round={1} passDirection="right" phase="playing" />);
      expect(screen.getByText("Pass right")).toBeInTheDocument();
   });

   it("displays 'No pass' when direction is none", () => {
      render(<InfoPill round={4} passDirection="none" phase="playing" />);
      expect(screen.getByText("No pass")).toBeInTheDocument();
   });

   it("displays phase", () => {
      render(<InfoPill round={1} passDirection="left" phase="passing" />);
      expect(screen.getByText("passing")).toBeInTheDocument();
   });

   it("displays playing phase", () => {
      render(<InfoPill round={2} passDirection="across" phase="playing" />);
      expect(screen.getByText("playing")).toBeInTheDocument();
   });

   it("displays 'Pass across'", () => {
      render(<InfoPill round={3} passDirection="across" phase="passing" />);
      expect(screen.getByText("Pass across")).toBeInTheDocument();
   });

   it("displays 'Pass left'", () => {
      render(<InfoPill round={1} passDirection="left" phase="passing" />);
      expect(screen.getByText("Pass left")).toBeInTheDocument();
   });
});
