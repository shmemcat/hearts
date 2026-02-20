import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { CreateGameSelections } from "./CreateGameSelections";

describe("CreateGameSelections", () => {
   it("renders game type radio buttons", () => {
      render(<CreateGameSelections />);
      expect(screen.getByLabelText("Versus AI")).toBeInTheDocument();
      expect(screen.getByLabelText("Online")).toBeInTheDocument();
   });

   it("defaults to Versus AI in uncontrolled mode", () => {
      render(<CreateGameSelections />);
      expect(screen.getByLabelText("Versus AI")).toBeChecked();
      expect(screen.getByLabelText("Online")).not.toBeChecked();
   });

   it("shows difficulty options when Versus AI is selected", () => {
      render(<CreateGameSelections />);
      expect(screen.getByText("AI Difficulty")).toBeInTheDocument();
      expect(screen.getByLabelText("Easy")).toBeInTheDocument();
      expect(screen.getByLabelText("Medium")).toBeInTheDocument();
      expect(screen.getByLabelText("My Mom")).toBeInTheDocument();
   });

   it("shows online AI options when Online is selected", async () => {
      const user = userEvent.setup();
      render(<CreateGameSelections />);
      await user.click(screen.getByLabelText("Online"));
      expect(screen.getByText("AI Players")).toBeInTheDocument();
      expect(
         screen.getByRole("checkbox", { name: "Include AI players" })
      ).toBeInTheDocument();
   });

   it("calls onGameTypeChange in controlled mode", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
         <CreateGameSelections
            gameType="Versus AI"
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
            gameType="Versus AI"
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

   it("toggles AI players in online mode", async () => {
      const user = userEvent.setup();
      const onAiChange = vi.fn();
      render(
         <CreateGameSelections
            gameType="Online"
            onGameTypeChange={() => {}}
            aiPlayersEnabled={false}
            onAiPlayersEnabledChange={onAiChange}
            numAiPlayers={1}
            onNumAiPlayersChange={() => {}}
         />
      );
      await user.click(
         screen.getByRole("checkbox", { name: "Include AI players" })
      );
      expect(onAiChange).toHaveBeenCalledWith(true);
   });

   it("disables number selector when AI not enabled", () => {
      render(
         <CreateGameSelections
            gameType="Online"
            onGameTypeChange={() => {}}
            aiPlayersEnabled={false}
            onAiPlayersEnabledChange={() => {}}
            numAiPlayers={1}
            onNumAiPlayersChange={() => {}}
         />
      );
      expect(
         screen.getByRole("combobox", { name: "Number of AI players" })
      ).toBeDisabled();
   });

   it("enables number selector when AI is enabled", () => {
      render(
         <CreateGameSelections
            gameType="Online"
            onGameTypeChange={() => {}}
            aiPlayersEnabled={true}
            onAiPlayersEnabledChange={() => {}}
            numAiPlayers={1}
            onNumAiPlayersChange={() => {}}
         />
      );
      expect(
         screen.getByRole("combobox", { name: "Number of AI players" })
      ).not.toBeDisabled();
   });

   it("shows difficulty when AI players are enabled in online mode", () => {
      render(
         <CreateGameSelections
            gameType="Online"
            onGameTypeChange={() => {}}
            aiPlayersEnabled={true}
            onAiPlayersEnabledChange={() => {}}
            numAiPlayers={1}
            onNumAiPlayersChange={() => {}}
            difficulty="Easy"
            onDifficultyChange={() => {}}
         />
      );
      expect(screen.getByText("AI Difficulty")).toBeInTheDocument();
   });

   it("shows tooltip on My Mom when showHardTooltip is true", async () => {
      const user = userEvent.setup();
      render(
         <CreateGameSelections
            gameType="Versus AI"
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
            gameType="Versus AI"
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
