import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { FormInput } from "./FormInput";

describe("FormInput", () => {
   it("renders an input element", () => {
      render(<FormInput placeholder="Enter text" />);
      expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
   });

   it("sets aria-invalid when error is present", () => {
      render(<FormInput error="Required" placeholder="field" />);
      expect(screen.getByPlaceholderText("field")).toHaveAttribute(
         "aria-invalid",
         "true"
      );
   });

   it("sets aria-invalid to false when no error", () => {
      render(<FormInput placeholder="field" />);
      expect(screen.getByPlaceholderText("field")).toHaveAttribute(
         "aria-invalid",
         "false"
      );
   });

   it("sets aria-invalid false for empty error string", () => {
      render(<FormInput error="" placeholder="field" />);
      expect(screen.getByPlaceholderText("field")).toHaveAttribute(
         "aria-invalid",
         "false"
      );
   });

   it("forwards ref to the input element", () => {
      const ref = createRef<HTMLInputElement>();
      render(<FormInput ref={ref} placeholder="ref-test" />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.placeholder).toBe("ref-test");
   });

   it("applies custom width style", () => {
      render(<FormInput width={200} placeholder="w" />);
      expect(screen.getByPlaceholderText("w")).toHaveStyle({ width: "200px" });
   });

   it("applies string width", () => {
      render(<FormInput width="50%" placeholder="w" />);
      expect(screen.getByPlaceholderText("w")).toHaveStyle({ width: "50%" });
   });

   it("applies fontWeight style", () => {
      render(<FormInput fontWeight="bold" placeholder="fw" />);
      expect(screen.getByPlaceholderText("fw")).toHaveStyle({
         fontWeight: "bold",
      });
   });

   it("passes through native input props", () => {
      render(
         <FormInput type="email" placeholder="Email" autoComplete="email" />
      );
      const input = screen.getByPlaceholderText("Email");
      expect(input).toHaveAttribute("type", "email");
      expect(input).toHaveAttribute("autocomplete", "email");
   });
});
