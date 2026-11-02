import { render, screen, fireEvent } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { useAuth } from "@/context/AuthContext";
import { CardStyleProvider } from "@/context/CardStyleContext";
import { HardLevelProvider } from "@/context/HardLevelContext";
import { MobileLayoutProvider } from "@/context/MobileLayoutContext";
import Profile from "./profile";
import Options from "./options";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/components/Navbar", () => ({ Navbar: () => null }));
let auth: ReturnType<typeof useAuth>;
beforeEach(() => {
   auth = {
      user: null,
      token: null,
      status: "unauthenticated",
      preferencesAvailable: false,
   } as ReturnType<typeof useAuth>;
   vi.mocked(useAuth).mockImplementation(() => auth);
});
function SignIn() {
   const navigate = useNavigate();
   return (
      <>
         <h1>Sign in</h1>
         <button onClick={() => navigate(-1)}>Back</button>
      </>
   );
}
function page(path: string) {
   return (
      <HelmetProvider>
         <MemoryRouter
            basename="/hearts"
            initialEntries={["/hearts/", `/hearts${path}`]}
         >
            <CardStyleProvider>
               <HardLevelProvider>
                  <MobileLayoutProvider>
                     <Routes>
                        <Route path="/" element={<h1>Home</h1>} />
                        <Route path="/user" element={<SignIn />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/options" element={<Options />} />
                     </Routes>
                  </MobileLayoutProvider>
               </HardLevelProvider>
            </CardStyleProvider>
         </MemoryRouter>
      </HelmetProvider>
   );
}
it.each(["/profile", "/options"])(
   "redirects a signed-out %s link to this site's sign-in page and replaces the history entry",
   (path) => {
      render(page(path));
      expect(
         screen.getByRole("heading", { name: "Sign in" })
      ).toBeInTheDocument();
      expect(
         screen.queryByRole("heading", { name: "Profile Icon" })
      ).not.toBeInTheDocument();
      expect(
         screen.queryByRole("heading", { name: "Card Style" })
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
   }
);
it.each([
   ["/profile", "Profile Icon"],
   ["/options", "Card Style"],
])(
   "waits for the session on %s, allows an account, and redirects when it signs out",
   (path, heading) => {
      auth.status = "loading";
      const view = render(page(path));
      expect(
         screen.queryByRole("heading", { name: "Sign in" })
      ).not.toBeInTheDocument();
      expect(
         screen.queryByRole("heading", { name: heading })
      ).not.toBeInTheDocument();
      auth.status = "authenticated";
      auth.token = "session";
      auth.user = {
         id: "player",
         name: "Player",
         email: "player@example.test",
      };
      view.rerender(page(path));
      expect(
         screen.getByRole("heading", { name: heading })
      ).toBeInTheDocument();
      auth.status = "unauthenticated";
      auth.token = null;
      auth.user = null;
      view.rerender(page(path));
      expect(
         screen.getByRole("heading", { name: "Sign in" })
      ).toBeInTheDocument();
      expect(
         screen.queryByRole("heading", { name: heading })
      ).not.toBeInTheDocument();
   }
);
