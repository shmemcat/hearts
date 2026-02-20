import { render, screen } from "@testing-library/react";
import { ErrorMessage } from "./ErrorMessage";

describe("ErrorMessage", () => {
   it("renders error text", () => {
      render(<ErrorMessage>Something went wrong</ErrorMessage>);
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
   });

   it("renders as a span", () => {
      const { container } = render(<ErrorMessage>Error</ErrorMessage>);
      expect(container.querySelector("span")).toBeInTheDocument();
   });

   it("applies custom className", () => {
      const { container } = render(
         <ErrorMessage className="custom">Error</ErrorMessage>
      );
      expect(container.querySelector("span")).toHaveClass("custom");
   });
});
