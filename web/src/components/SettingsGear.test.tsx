import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { GearOverlay } from "./SettingsGear";

const account = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => account }));
function page(path = "/user") {
   return (
      <MemoryRouter initialEntries={[path]}>
         <GearOverlay />
      </MemoryRouter>
   );
}
beforeEach(() => {
   account.user = { id: "player" };
});

it("puts Profile and Options inside the gear on the account page", async () => {
   const user = userEvent.setup();
   render(page());
   const gear = screen.getByRole("button", { name: "Settings menu" });
   expect(gear).toHaveAttribute("aria-expanded", "false");
   expect(
      screen.queryByRole("link", { name: "Profile" })
   ).not.toBeInTheDocument();
   expect(
      screen.queryByRole("link", { name: "Options" })
   ).not.toBeInTheDocument();
   await user.click(gear);
   expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile"
   );
   expect(screen.getByRole("link", { name: "Options" })).toHaveAttribute(
      "href",
      "/options"
   );
   await user.keyboard("{Escape}");
   expect(gear).toHaveFocus();
   expect(gear).toHaveAttribute("aria-expanded", "false");
});

it.each([
   ["/profile", "Profile", "Options"],
   ["/options", "Options", "Profile"],
])(
   "keeps the gear on %s and excludes the current page",
   async (path, current, other) => {
      const user = userEvent.setup();
      render(page(path));
      await user.click(screen.getByRole("button", { name: "Settings menu" }));
      expect(
         screen.queryByRole("link", { name: current })
      ).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: other })).toBeVisible();
      fireEvent.pointerDown(document.body);
      expect(
         screen.getByRole("button", { name: "Settings menu" })
      ).toHaveAttribute("aria-expanded", "false");
   }
);

it("does not add a gear to game or home pages", () => {
   const view = render(page("/play"));
   expect(
      screen.queryByRole("button", { name: "Settings menu" })
   ).not.toBeInTheDocument();
   view.unmount();
   render(page("/"));
   expect(
      screen.queryByRole("button", { name: "Settings menu" })
   ).not.toBeInTheDocument();
});

it("keeps the account gear hidden for guests", () => {
   account.user = null;
   render(page());
   expect(
      screen.queryByRole("button", { name: "Settings menu" })
   ).not.toBeInTheDocument();
});
