import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ActiveGameModal } from "./ActiveGameModal";

describe("ActiveGameModal", () => {
   it("shows initial state with game in progress message", () => {
      render(
         <ActiveGameModal onContinue={vi.fn()} onConcede={vi.fn()} />
      );
      expect(screen.getByText("Game In Progress")).toBeInTheDocument();
      expect(
         screen.getByText(/You have a game active/)
      ).toBeInTheDocument();
   });

   it("shows Continue and Concede buttons initially", () => {
      render(
         <ActiveGameModal onContinue={vi.fn()} onConcede={vi.fn()} />
      );
      expect(
         screen.getByRole("button", { name: "Continue" })
      ).toBeInTheDocument();
      expect(
         screen.getByRole("button", { name: "Concede" })
      ).toBeInTheDocument();
   });

   it("clicking Continue calls onContinue", async () => {
      const user = userEvent.setup();
      const onContinue = vi.fn();
      render(
         <ActiveGameModal onContinue={onContinue} onConcede={vi.fn()} />
      );
      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(onContinue).toHaveBeenCalled();
   });

   it("clicking Concede shows confirmation", async () => {
      const user = userEvent.setup();
      render(
         <ActiveGameModal onContinue={vi.fn()} onConcede={vi.fn()} />
      );
      await user.click(screen.getByRole("button", { name: "Concede" }));
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
   });

   it("confirmation No goes back to initial state", async () => {
      const user = userEvent.setup();
      render(
         <ActiveGameModal onContinue={vi.fn()} onConcede={vi.fn()} />
      );
      await user.click(screen.getByRole("button", { name: "Concede" }));
      await user.click(screen.getByRole("button", { name: "No" }));
      expect(screen.getByText("Game In Progress")).toBeInTheDocument();
   });

   it("confirmation Yes calls onConcede", async () => {
      const user = userEvent.setup();
      const onConcede = vi.fn();
      render(
         <ActiveGameModal onContinue={vi.fn()} onConcede={onConcede} />
      );
      await user.click(screen.getByRole("button", { name: "Concede" }));
      await user.click(screen.getByRole("button", { name: "Yes" }));
      expect(onConcede).toHaveBeenCalled();
   });
});
