import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { BotDifficultyModal } from "./BotDifficultyModal";

describe("BotDifficultyModal", () => {
   it("renders bot count in message", () => {
      render(
         <BotDifficultyModal
            botCount={2}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
         />
      );
      expect(screen.getByText(/2 seats will be filled/)).toBeInTheDocument();
   });

   it("uses singular 'seat' for 1 bot", () => {
      render(
         <BotDifficultyModal
            botCount={1}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
         />
      );
      expect(screen.getByText(/1 seat will be filled/)).toBeInTheDocument();
   });

   it("defaults to Easy radio selected", () => {
      render(
         <BotDifficultyModal
            botCount={3}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
         />
      );
      const easyRadio = screen.getByRole("radio", { name: "Easy" });
      expect(easyRadio).toBeChecked();
   });

   it("selects difficulty and clicks Start calls onConfirm with lowercase value", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
         <BotDifficultyModal
            botCount={2}
            onConfirm={onConfirm}
            onCancel={vi.fn()}
         />
      );
      await user.click(screen.getByRole("radio", { name: "Hard" }));
      await user.click(screen.getByRole("button", { name: "Start!" }));
      expect(onConfirm).toHaveBeenCalledWith("hard");
   });

   it("clicking Cancel calls onCancel", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(
         <BotDifficultyModal
            botCount={2}
            onConfirm={vi.fn()}
            onCancel={onCancel}
         />
      );
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onCancel).toHaveBeenCalled();
   });
});
