import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
   it("renders a checkbox input", () => {
      render(
         <Toggle checked={false} onCheckedChange={() => {}} aria-label="test toggle" />
      );
      expect(screen.getByRole("checkbox", { name: "test toggle" })).toBeInTheDocument();
   });

   it("reflects checked state", () => {
      render(
         <Toggle checked={true} onCheckedChange={() => {}} aria-label="toggle" />
      );
      expect(screen.getByRole("checkbox")).toBeChecked();
   });

   it("reflects unchecked state", () => {
      render(
         <Toggle checked={false} onCheckedChange={() => {}} aria-label="toggle" />
      );
      expect(screen.getByRole("checkbox")).not.toBeChecked();
   });

   it("calls onCheckedChange when toggled", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
         <Toggle checked={false} onCheckedChange={onChange} aria-label="toggle" />
      );
      await user.click(screen.getByRole("checkbox"));
      expect(onChange).toHaveBeenCalledWith(true);
   });

   it("respects disabled state", () => {
      render(
         <Toggle
            checked={false}
            onCheckedChange={() => {}}
            disabled
            aria-label="toggle"
         />
      );
      expect(screen.getByRole("checkbox")).toBeDisabled();
   });
});
