import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Button, RulesButton } from "./Buttons";

describe("Button", () => {
   it("renders with the provided name as aria-label", () => {
      render(<Button name="Play" />);
      expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
   });

   it("displays name text when no children", () => {
      render(<Button name="Start" />);
      expect(screen.getByText("Start")).toBeInTheDocument();
   });

   it("renders children instead of name when provided", () => {
      render(
         <Button name="btn">
            <span>Custom</span>
         </Button>
      );
      expect(screen.getByText("Custom")).toBeInTheDocument();
   });

   it("fires onClick when clicked", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Button name="Click" onClick={onClick} />);
      await user.click(screen.getByRole("button"));
      expect(onClick).toHaveBeenCalledTimes(1);
   });

   it("respects disabled state", () => {
      render(<Button name="Disabled" disabled />);
      expect(screen.getByRole("button")).toBeDisabled();
   });

   it("applies custom style", () => {
      render(<Button name="Styled" style={{ width: "200px" }} />);
      expect(screen.getByRole("button")).toHaveStyle({ width: "200px" });
   });

   it("defaults to type button", () => {
      render(<Button name="Btn" />);
      expect(screen.getByRole("button")).not.toHaveAttribute("type", "submit");
   });

   it("accepts type=submit", () => {
      render(<Button name="Submit" type="submit" />);
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
   });
});

describe("RulesButton", () => {
   it("renders with the provided name", () => {
      render(
         <RulesButton name="Overview" selected={false} onClick={() => {}} />
      );
      expect(
         screen.getByRole("button", { name: "Overview" })
      ).toBeInTheDocument();
   });

   it("displays name text", () => {
      render(
         <RulesButton name="Scoring" selected={false} onClick={() => {}} />
      );
      expect(screen.getByText("Scoring")).toBeInTheDocument();
   });

   it("fires onClick when clicked", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<RulesButton name="Test" selected={false} onClick={onClick} />);
      await user.click(screen.getByRole("button"));
      expect(onClick).toHaveBeenCalledTimes(1);
   });

   it("sets data-selected attribute when selected", () => {
      render(<RulesButton name="Active" selected onClick={() => {}} />);
      expect(screen.getByRole("button")).toHaveAttribute(
         "data-selected",
         "true"
      );
   });

   it("sets data-selected=false when not selected", () => {
      render(
         <RulesButton name="Inactive" selected={false} onClick={() => {}} />
      );
      expect(screen.getByRole("button")).toHaveAttribute(
         "data-selected",
         "false"
      );
   });
});
