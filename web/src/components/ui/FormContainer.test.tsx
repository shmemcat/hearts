import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { FormContainer } from "./FormContainer";

describe("FormContainer", () => {
   it("renders children inside a form", () => {
      render(
         <FormContainer>
            <input placeholder="Name" />
         </FormContainer>
      );
      expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
   });

   it("renders as a <form> element", () => {
      const { container } = render(
         <FormContainer>
            <span>content</span>
         </FormContainer>
      );
      expect(container.querySelector("form")).toBeInTheDocument();
   });

   it("applies top margin by default", () => {
      const { container } = render(
         <FormContainer>
            <span>content</span>
         </FormContainer>
      );
      expect(container.querySelector("form")).toHaveClass("mt-5");
   });

   it("omits top margin when topMargin=false", () => {
      const { container } = render(
         <FormContainer topMargin={false}>
            <span>content</span>
         </FormContainer>
      );
      expect(container.querySelector("form")).not.toHaveClass("mt-5");
   });

   it("passes through form attributes like onSubmit", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
         <FormContainer onSubmit={onSubmit}>
            <button type="submit">Go</button>
         </FormContainer>
      );
      await user.click(screen.getByText("Go"));
      expect(onSubmit).toHaveBeenCalled();
   });
});
