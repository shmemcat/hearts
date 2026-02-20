import { render, screen } from "@testing-library/react";
import { GameSeat } from "./GameSeat";

describe("GameSeat", () => {
   const baseProps = {
      name: "Alice",
      score: 15,
      position: "top" as const,
      isCurrentTurn: false,
      showHearts: false,
      heartCount: 0,
   };

   it("renders player name", () => {
      render(<GameSeat {...baseProps} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
   });

   it("renders player score", () => {
      render(<GameSeat {...baseProps} />);
      expect(screen.getByText(/15/)).toBeInTheDocument();
   });

   it("shows heart count when showHearts is true", () => {
      render(<GameSeat {...baseProps} showHearts heartCount={3} />);
      expect(screen.getByText(/♥/)).toBeInTheDocument();
   });

   it("does not show hearts when showHearts is false", () => {
      render(<GameSeat {...baseProps} showHearts={false} heartCount={5} />);
      expect(screen.queryByText(/♥/)).not.toBeInTheDocument();
   });

   it("applies current turn styling class", () => {
      const { container } = render(
         <GameSeat {...baseProps} isCurrentTurn={true} />
      );
      const seat = container.firstChild as HTMLElement;
      expect(seat.className).toContain("YourTurn");
   });

   it("renders different positions", () => {
      const positions = ["top", "left", "right", "bottom"] as const;
      for (const position of positions) {
         const { container, unmount } = render(
            <GameSeat {...baseProps} position={position} />
         );
         expect(container.firstChild).toBeInTheDocument();
         unmount();
      }
   });
});
