import { screen } from "@testing-library/react";
import Custom404 from "./404";
import { renderWithProviders } from "@/test/helpers";

describe("404 Page", () => {
   it("renders page not found message", () => {
      renderWithProviders(<Custom404 />, { route: "/nonexistent" });
      expect(screen.getByText("Page not found!")).toBeInTheDocument();
   });

   it("renders Home button", () => {
      renderWithProviders(<Custom404 />, { route: "/nonexistent" });
      expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
   });
});
