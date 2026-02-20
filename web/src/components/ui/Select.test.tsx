import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Select, type SelectOption } from "./Select";

const options: SelectOption<string>[] = [
   { value: "a", label: "Alpha" },
   { value: "b", label: "Beta" },
   { value: "c", label: "Gamma" },
];

describe("Select", () => {
   it("renders all options", () => {
      render(
         <Select value="a" onChange={() => {}} options={options} aria-label="test" />
      );
      const selectEl = screen.getByRole("combobox", { name: "test" });
      expect(selectEl).toBeInTheDocument();
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Beta")).toBeInTheDocument();
      expect(screen.getByText("Gamma")).toBeInTheDocument();
   });

   it("shows selected value", () => {
      render(
         <Select value="b" onChange={() => {}} options={options} aria-label="test" />
      );
      expect(screen.getByRole("combobox")).toHaveValue("b");
   });

   it("calls onChange when selection changes", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
         <Select value="a" onChange={onChange} options={options} aria-label="test" />
      );
      await user.selectOptions(screen.getByRole("combobox"), "c");
      expect(onChange).toHaveBeenCalledWith("c");
   });

   it("respects disabled state", () => {
      render(
         <Select value="a" onChange={() => {}} options={options} disabled aria-label="test" />
      );
      expect(screen.getByRole("combobox")).toBeDisabled();
   });

   it("works with numeric values", async () => {
      const user = userEvent.setup();
      const numOptions: SelectOption<number>[] = [
         { value: 1, label: "One" },
         { value: 2, label: "Two" },
         { value: 3, label: "Three" },
      ];
      const onChange = vi.fn();
      render(
         <Select<number>
            value={1}
            onChange={onChange}
            options={numOptions}
            aria-label="nums"
         />
      );
      await user.selectOptions(screen.getByRole("combobox"), "2");
      expect(onChange).toHaveBeenCalledWith(2);
   });
});
