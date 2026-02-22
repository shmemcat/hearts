import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { CardStyleProvider } from "@/context/CardStyleContext";
import { HardLevelProvider } from "@/context/HardLevelContext";
import { SoundProvider } from "@/context/SoundContext";
import { MobileLayoutProvider } from "@/context/MobileLayoutContext";

import Home from "@/pages/index";
import User from "@/pages/user";
import About from "@/pages/about";
import Options from "@/pages/options";
import Rules from "@/pages/rules";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import ResendVerification from "@/pages/resend-verification";
import CreateGame from "@/pages/game/create";
import JoinGame from "@/pages/game/join";
import PlayGame from "@/pages/game/play";
import NotFound from "@/pages/404";

export default function App() {
   const location = useLocation();

   return (
      <ThemeProvider>
         <AuthProvider>
            <CardStyleProvider>
               <HardLevelProvider>
                  <SoundProvider>
                     <MobileLayoutProvider>
                        <div>
                           <AnimatePresence mode="wait">
                              <motion.div key={location.pathname}>
                                 <Routes location={location}>
                                    <Route path="/" element={<Home />} />
                                    <Route path="/user" element={<User />} />
                                    <Route path="/about" element={<About />} />
                                    <Route
                                       path="/options"
                                       element={<Options />}
                                    />
                                    <Route path="/rules" element={<Rules />} />
                                    <Route
                                       path="/register"
                                       element={<Register />}
                                    />
                                    <Route
                                       path="/forgot-password"
                                       element={<ForgotPassword />}
                                    />
                                    <Route
                                       path="/reset-password"
                                       element={<ResetPassword />}
                                    />
                                    <Route
                                       path="/verify-email"
                                       element={<VerifyEmail />}
                                    />
                                    <Route
                                       path="/resend-verification"
                                       element={<ResendVerification />}
                                    />
                                    <Route
                                       path="/game/create"
                                       element={<CreateGame />}
                                    />
                                    <Route
                                       path="/game/join"
                                       element={<JoinGame />}
                                    />
                                    <Route
                                       path="/game/play"
                                       element={<PlayGame />}
                                    />
                                    <Route path="*" element={<NotFound />} />
                                 </Routes>
                              </motion.div>
                           </AnimatePresence>
                        </div>
                     </MobileLayoutProvider>
                  </SoundProvider>
               </HardLevelProvider>
            </CardStyleProvider>
         </AuthProvider>
      </ThemeProvider>
   );
}
