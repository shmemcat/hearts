import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StyledLink } from "./StyledLink";

function renderInRouter(ui: React.ReactElement) {
   return render(ui, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
}

describe("StyledLink", () => {
   it("renders external links as <a> tags", () => {
      renderInRouter(
         <StyledLink href="https://example.com">External</StyledLink>
      );
      const link = screen.getByText("External");
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", "https://example.com");
   });

   it("renders http links as <a> tags", () => {
      renderInRouter(
         <StyledLink href="http://example.com">HTTP</StyledLink>
      );
      const link = screen.getByText("HTTP");
      expect(link.tagName).toBe("A");
   });

   it("renders internal links as React Router Links", () => {
      renderInRouter(
         <StyledLink href="/user">Internal</StyledLink>
      );
      const link = screen.getByText("Internal");
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", "/user");
   });

   it("applies link class", () => {
      renderInRouter(
         <StyledLink href="/test">Link</StyledLink>
      );
      expect(screen.getByText("Link")).toHaveClass("link");
   });

   it("applies additional className", () => {
      renderInRouter(
         <StyledLink href="/test" className="extra">Link</StyledLink>
      );
      const link = screen.getByText("Link");
      expect(link).toHaveClass("link");
      expect(link).toHaveClass("extra");
   });
});
