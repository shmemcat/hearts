import { render, screen } from "@testing-library/react";
import { PhaseHint } from "./PhaseHint";

describe("PhaseHint", () => {
   it("renders text when provided", () => {
      render(<PhaseHint text="Select 3 cards to pass" />);
      expect(screen.getByText("Select 3 cards to pass")).toBeInTheDocument();
   });

   it("is visible when text is provided", () => {
      const { container } = render(<PhaseHint text="Your turn" />);
      const p = container.querySelector("p")!;
      expect(p.style.visibility).not.toBe("hidden");
      expect(p).toHaveAttribute("aria-hidden", "false");
   });

   it("is hidden but in DOM when text is null", () => {
      const { container } = render(<PhaseHint text={null} />);
      const p = container.querySelector("p")!;
      expect(p).toBeInTheDocument();
      expect(p.style.visibility).toBe("hidden");
      expect(p).toHaveAttribute("aria-hidden", "true");
   });

   it("renders non-breaking space when hidden to preserve layout", () => {
      const { container } = render(<PhaseHint text={null} />);
      const p = container.querySelector("p")!;
      expect(p.textContent).toBe("\u00A0");
   });
});
