import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { renderWithProviders } from "@/test/helpers";

describe("DeleteAccountModal", () => {
   const onClose = vi.fn();
   const onDelete = vi.fn();

   beforeEach(() => {
      onClose.mockReset();
      onDelete.mockReset();
   });

   function renderModal() {
      return renderWithProviders(
         <DeleteAccountModal onClose={onClose} onDelete={onDelete} />
      );
   }

   describe("Step 1 - Warning", () => {
      it("shows warning message", () => {
         renderModal();
         expect(screen.getByText("Delete Account")).toBeInTheDocument();
         expect(
            screen.getByText(/delete all your user data/i)
         ).toBeInTheDocument();
      });

      it("shows No and Yes buttons", () => {
         renderModal();
         expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
         expect(
            screen.getByRole("button", { name: "Yes" })
         ).toBeInTheDocument();
      });

      it("calls onClose when No is clicked", async () => {
         const user = userEvent.setup();
         renderModal();
         await user.click(screen.getByRole("button", { name: "No" }));
         expect(onClose).toHaveBeenCalledOnce();
      });

      it("advances to step 2 when Yes is clicked", async () => {
         const user = userEvent.setup();
         renderModal();
         await user.click(screen.getByRole("button", { name: "Yes" }));
         expect(screen.getByText("Confirm Deletion")).toBeInTheDocument();
         expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
      });

      it("calls onClose when backdrop is clicked", async () => {
         const user = userEvent.setup();
         const { container } = renderModal();
         const backdrop = container.firstChild as HTMLElement;
         await user.click(backdrop);
         expect(onClose).toHaveBeenCalledOnce();
      });
   });

   describe("Step 2 - Password Confirmation", () => {
      async function goToStep2() {
         const user = userEvent.setup();
         renderModal();
         await user.click(screen.getByRole("button", { name: "Yes" }));
         return user;
      }

      it("shows password input and buttons", async () => {
         await goToStep2();
         expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
         expect(
            screen.getByRole("button", { name: "Nevermind" })
         ).toBeInTheDocument();
         expect(
            screen.getByRole("button", { name: "Delete" })
         ).toBeInTheDocument();
      });

      it("calls onClose when Nevermind is clicked", async () => {
         const user = await goToStep2();
         await user.click(screen.getByRole("button", { name: "Nevermind" }));
         expect(onClose).toHaveBeenCalledOnce();
      });

      it("shows error when Delete clicked with empty password", async () => {
         const user = await goToStep2();
         await user.click(screen.getByRole("button", { name: "Delete" }));
         await waitFor(() => {
            expect(
               screen.getByText("Please enter your password.")
            ).toBeInTheDocument();
         });
      });

      it("calls onDelete with password", async () => {
         onDelete.mockResolvedValueOnce({});
         const user = await goToStep2();
         await user.type(screen.getByPlaceholderText("Password"), "mypassword");
         await user.click(screen.getByRole("button", { name: "Delete" }));
         await waitFor(() => {
            expect(onDelete).toHaveBeenCalledWith("mypassword");
         });
      });

      it("shows error from onDelete", async () => {
         onDelete.mockResolvedValueOnce({ error: "Incorrect password" });
         const user = await goToStep2();
         await user.type(screen.getByPlaceholderText("Password"), "wrongpass");
         await user.click(screen.getByRole("button", { name: "Delete" }));
         await waitFor(() => {
            expect(screen.getByText("Incorrect password")).toBeInTheDocument();
         });
      });
   });
});
