import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ConcedeModal, ConcedeButton } from "./ConcedeModal";

describe("ConcedeModal", () => {
   it("shows step 1 initially", () => {
      render(<ConcedeModal onClose={vi.fn()} onConcede={vi.fn()} />);
      expect(
         screen.getByText("Do you wish to concede this game?")
      ).toBeInTheDocument();
   });

   it("shows Continue and Concede buttons in step 1", () => {
      render(<ConcedeModal onClose={vi.fn()} onConcede={vi.fn()} />);
      expect(
         screen.getByRole("button", { name: "Continue" })
      ).toBeInTheDocument();
      expect(
         screen.getByRole("button", { name: "Concede" })
      ).toBeInTheDocument();
   });

   it("renders concede title", () => {
      const { container } = render(
         <ConcedeModal onClose={vi.fn()} onConcede={vi.fn()} />
      );
      const title = container.querySelector("[class*='title']");
      expect(title).toHaveTextContent("Concede");
   });

   it("clicking Continue calls onClose", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ConcedeModal onClose={onClose} onConcede={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(onClose).toHaveBeenCalled();
   });

   it("clicking Concede advances to step 2", async () => {
      const user = userEvent.setup();
      render(<ConcedeModal onClose={vi.fn()} onConcede={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Concede" }));
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      expect(
         screen.getByText("Are you sure you wish to concede?")
      ).toBeInTheDocument();
   });

   it("step 2: clicking No returns to step 1", async () => {
      const user = userEvent.setup();
      render(<ConcedeModal onClose={vi.fn()} onConcede={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: "Concede" }));
      await user.click(screen.getByRole("button", { name: "No" }));
      expect(
         screen.getByText("Do you wish to concede this game?")
      ).toBeInTheDocument();
   });

   it("step 2: clicking Yes calls onConcede", async () => {
      const user = userEvent.setup();
      const onConcede = vi.fn();
      render(<ConcedeModal onClose={vi.fn()} onConcede={onConcede} />);
      await user.click(screen.getByRole("button", { name: "Concede" }));
      await user.click(screen.getByRole("button", { name: "Yes" }));
      expect(onConcede).toHaveBeenCalledTimes(1);
   });

   it("clicking backdrop calls onClose", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const { container } = render(
         <ConcedeModal onClose={onClose} onConcede={vi.fn()} />
      );
      const backdrop = container.firstChild as HTMLElement;
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalled();
   });
});

describe("ConcedeButton", () => {
   it("renders with concede aria-label", () => {
      render(<ConcedeButton onClick={vi.fn()} />);
      expect(
         screen.getByRole("button", { name: "Concede game" })
      ).toBeInTheDocument();
   });

   it("fires onClick", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<ConcedeButton onClick={onClick} />);
      await user.click(screen.getByRole("button"));
      expect(onClick).toHaveBeenCalled();
   });
});
