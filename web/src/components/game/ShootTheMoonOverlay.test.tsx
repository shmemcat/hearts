import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ShootTheMoonOverlay } from "./ShootTheMoonOverlay";
import { SoundProvider } from "@/context/SoundContext";

function renderOverlay(
   props: Partial<React.ComponentProps<typeof ShootTheMoonOverlay>> = {}
) {
   const defaults = {
      shooterIndex: 0,
      deltas: [0, 26, 26, 26],
      round: 1,
      players: [
         { name: "You", score: 0 },
         { name: "Alice", score: 26 },
         { name: "Bob", score: 26 },
         { name: "Carol", score: 26 },
      ],
      onContinue: vi.fn(),
      ...props,
   };
   return render(
      <SoundProvider>
         <ShootTheMoonOverlay {...defaults} />
      </SoundProvider>
   );
}

describe("ShootTheMoonOverlay", () => {
   it("displays 'Shot the Moon!' title", () => {
      renderOverlay();
      expect(screen.getByText("Shot the Moon!")).toBeInTheDocument();
   });

   it("shows shooter name message", () => {
      renderOverlay({ shooterIndex: 0 });
      expect(screen.getByText(/You took all the hearts/)).toBeInTheDocument();
   });

   it("shows non-shooter name when different player shoots", () => {
      renderOverlay({
         shooterIndex: 1,
         players: [
            { name: "You", score: 26 },
            { name: "Alice", score: 0 },
            { name: "Bob", score: 26 },
            { name: "Carol", score: 26 },
         ],
      });
      expect(screen.getByText(/Alice took all the hearts/)).toBeInTheDocument();
   });

   it("shows 0 for shooter delta and +N for others", () => {
      renderOverlay();
      const badges = screen.getAllByText(/^\+?\d+$/);
      const texts = badges.map((b) => b.textContent);
      expect(texts).toContain("0");
      expect(texts).toContain("+26");
   });

   it("displays all player names in deltas", () => {
      renderOverlay();
      expect(screen.getByText("You")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Carol")).toBeInTheDocument();
   });

   it("clicking Continue calls onContinue", async () => {
      const user = userEvent.setup();
      const onContinue = vi.fn();
      renderOverlay({ onContinue });
      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(onContinue).toHaveBeenCalled();
   });
});
