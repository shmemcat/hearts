import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { CreateGameSelections } from "./CreateGameSelections";

describe("CreateGameSelections", () => {
   it("renders game type radio buttons", () => {
      render(<CreateGameSelections />);
      expect(screen.getByLabelText("Versus Bots")).toBeInTheDocument();
      expect(screen.getByLabelText("Online")).toBeInTheDocument();
   });

   it("defaults to Versus Bots in uncontrolled mode", () => {
      render(<CreateGameSelections />);
      expect(screen.getByLabelText("Versus Bots")).toBeChecked();
      expect(screen.getByLabelText("Online")).not.toBeChecked();
   });

   it("shows difficulty options when Versus Bots is selected", () => {
      render(<CreateGameSelections />);
      expect(screen.getByText("Bot Difficulty")).toBeInTheDocument();
      expect(screen.getByLabelText("Easy")).toBeInTheDocument();
      expect(screen.getByLabelText("Medium")).toBeInTheDocument();
      expect(screen.getByLabelText("My Mom")).toBeInTheDocument();
   });

   it("shows backfill info when Online is selected", async () => {
      const user = userEvent.setup();
      render(<CreateGameSelections />);
      await user.click(screen.getByLabelText("Online"));
      expect(
         screen.getByText(/Empty seats are filled by bots/)
      ).toBeInTheDocument();
   });

   it("calls onGameTypeChange in controlled mode", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
         <CreateGameSelections
            gameType="Versus Bots"
            onGameTypeChange={onChange}
         />
      );
      await user.click(screen.getByLabelText("Online"));
      expect(onChange).toHaveBeenCalledWith("Online");
   });

   it("calls onDifficultyChange in controlled mode", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
         <CreateGameSelections
            gameType="Versus Bots"
            onGameTypeChange={() => {}}
            difficulty="Easy"
            onDifficultyChange={onChange}
         />
      );
      await user.click(screen.getByLabelText("Medium"));
      expect(onChange).toHaveBeenCalledWith("Medium");
   });

   it("defaults difficulty to Easy in uncontrolled mode", () => {
      render(<CreateGameSelections />);
      expect(screen.getByLabelText("Easy")).toBeChecked();
   });

   it("shows tooltip on My Mom when showHardTooltip is true", async () => {
      const user = userEvent.setup();
      render(
         <CreateGameSelections
            gameType="Versus Bots"
            onGameTypeChange={() => {}}
            difficulty="Easy"
            onDifficultyChange={() => {}}
            showHardTooltip={true}
         />
      );
      const myMom = screen.getByLabelText("My Mom");
      await user.hover(myMom);
      const matches = await screen.findAllByText(
         /Bump up the difficulty in Options/
      );
      expect(matches.length).toBeGreaterThan(0);
   });

   it("does not show tooltip on My Mom when showHardTooltip is false", () => {
      render(
         <CreateGameSelections
            gameType="Versus Bots"
            onGameTypeChange={() => {}}
            difficulty="Easy"
            onDifficultyChange={() => {}}
            showHardTooltip={false}
         />
      );
      expect(
         screen.queryByText(/Bump up the difficulty in Options/)
      ).not.toBeInTheDocument();
   });
});
