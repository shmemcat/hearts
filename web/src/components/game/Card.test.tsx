import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Card } from "./Card";
import { CardStyleProvider } from "@/context/CardStyleContext";

function renderCard(props: React.ComponentProps<typeof Card>) {
   return render(
      <CardStyleProvider>
         <Card {...props} />
      </CardStyleProvider>
   );
}

describe("Card", () => {
   it("renders with correct aria-label", () => {
      renderCard({ code: "2c" });
      expect(screen.getByRole("button", { name: "Card 2 of c" })).toBeInTheDocument();
   });

   it("parses card code correctly (10 of diamonds)", () => {
      renderCard({ code: "10d" });
      expect(screen.getByRole("button", { name: "Card 10 of d" })).toBeInTheDocument();
   });

   it("parses face card code (Jack of spades)", () => {
      renderCard({ code: "Js" });
      expect(screen.getByRole("button", { name: "Card J of s" })).toBeInTheDocument();
   });

   it("displays rank and suit symbol in standard style", () => {
      renderCard({ code: "Ah" });
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.getByText("♥")).toBeInTheDocument();
   });

   it("displays suit symbol for clubs", () => {
      renderCard({ code: "Kc" });
      expect(screen.getByText("♣")).toBeInTheDocument();
   });

   it("fires onClick when clicked", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      renderCard({ code: "2c", onClick });
      await user.click(screen.getByRole("button"));
      expect(onClick).toHaveBeenCalledTimes(1);
   });

   it("does not fire onClick when disabled", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      renderCard({ code: "2c", onClick, disabled: true });
      await user.click(screen.getByRole("button"));
      expect(onClick).not.toHaveBeenCalled();
   });

   it("renders image in flourish style", () => {
      renderCard({ code: "Ah", styleOverride: "flourish" });
      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "/cards/Ah.png");
      expect(img).toHaveAttribute("alt", "A of h");
   });

   it("handles malformed card codes gracefully", () => {
      renderCard({ code: "x" });
      expect(screen.getByRole("button", { name: "Card ? of ?" })).toBeInTheDocument();
   });

   it("handles empty code", () => {
      renderCard({ code: "" });
      expect(screen.getByRole("button", { name: "Card ? of ?" })).toBeInTheDocument();
   });
});
