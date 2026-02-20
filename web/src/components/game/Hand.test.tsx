import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Hand } from "./Hand";
import { CardStyleProvider } from "@/context/CardStyleContext";

function renderHand(props: React.ComponentProps<typeof Hand>) {
   return render(
      <CardStyleProvider>
         <Hand {...props} />
      </CardStyleProvider>
   );
}

describe("Hand", () => {
   it("renders all cards", () => {
      renderHand({ cards: ["2c", "5d", "Ah"] });
      expect(screen.getByRole("button", { name: "Card 2 of c" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Card 5 of d" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Card A of h" })).toBeInTheDocument();
   });

   it("has group role with aria-label", () => {
      renderHand({ cards: ["2c"] });
      expect(screen.getByRole("group", { name: "Your hand" })).toBeInTheDocument();
   });

   it("sorts cards by suit (c < d < s < h) then rank (high to low)", () => {
      renderHand({ cards: ["3h", "Ac", "2d", "Ks"] });
      const buttons = screen.getAllByRole("button");
      const labels = buttons.map((b) => b.getAttribute("aria-label"));
      expect(labels).toEqual([
         "Card A of c",
         "Card 2 of d",
         "Card K of s",
         "Card 3 of h",
      ]);
   });

   it("in selection mode, allows selecting cards", async () => {
      const user = userEvent.setup();
      const onCardClick = vi.fn();
      renderHand({
         cards: ["2c", "5d"],
         selectionMode: true,
         selectedCodes: new Set(),
         onCardClick,
      });
      await user.click(screen.getByRole("button", { name: "Card 2 of c" }));
      expect(onCardClick).toHaveBeenCalledWith("2c");
   });

   it("marks selected cards as selected", () => {
      const { container } = renderHand({
         cards: ["2c", "5d"],
         selectionMode: true,
         selectedCodes: new Set(["2c"]),
      });
      const buttons = container.querySelectorAll("button");
      const cardClasses = Array.from(buttons).map((b) => b.className);
      expect(cardClasses[0]).toContain("cardSelected");
   });

   it("disables non-legal cards when legalCodes is provided", () => {
      renderHand({
         cards: ["2c", "5d", "Ah"],
         legalCodes: new Set(["2c"]),
         onCardClick: vi.fn(),
      });
      expect(screen.getByRole("button", { name: "Card 2 of c" })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "Card 5 of d" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Card A of h" })).toBeDisabled();
   });

   it("calls onCardClick with the correct card code during play", async () => {
      const user = userEvent.setup();
      const onCardClick = vi.fn();
      renderHand({
         cards: ["2c", "5d"],
         legalCodes: new Set(["2c", "5d"]),
         onCardClick,
      });
      await user.click(screen.getByRole("button", { name: "Card 5 of d" }));
      expect(onCardClick).toHaveBeenCalledWith("5d");
   });
});
