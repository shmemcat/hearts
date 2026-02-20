import { render, screen } from "@testing-library/react";
import { ButtonGroup } from "./ButtonGroup";

describe("ButtonGroup", () => {
   it("renders children", () => {
      render(
         <ButtonGroup>
            <button>Click me</button>
         </ButtonGroup>
      );
      expect(screen.getByText("Click me")).toBeInTheDocument();
   });

   it("applies default padding class (pt-6)", () => {
      const { container } = render(
         <ButtonGroup>
            <span>child</span>
         </ButtonGroup>
      );
      expect(container.firstChild).toHaveClass("pt-6");
   });

   it("applies tight padding class (pt-4)", () => {
      const { container } = render(
         <ButtonGroup padding="tight">
            <span>child</span>
         </ButtonGroup>
      );
      expect(container.firstChild).toHaveClass("pt-4");
   });

   it("applies loose padding class (pt-10)", () => {
      const { container } = render(
         <ButtonGroup padding="loose">
            <span>child</span>
         </ButtonGroup>
      );
      expect(container.firstChild).toHaveClass("pt-10");
   });

   it("applies custom className", () => {
      const { container } = render(
         <ButtonGroup className="extra">
            <span>child</span>
         </ButtonGroup>
      );
      expect(container.firstChild).toHaveClass("extra");
   });
});
