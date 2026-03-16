import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CardStyleProvider } from "@/context/CardStyleContext";
import { HardLevelProvider } from "@/context/HardLevelContext";
import { SoundProvider } from "@/context/SoundContext";
import { MobileLayoutProvider } from "@/context/MobileLayoutContext";
import { ToastProvider } from "@/context/ToastContext";
import { SettingsGear } from "@/components/SettingsGear";
import styles from "@/components/SettingsGear.module.css";

import Home from "@/pages/index";
import User from "@/pages/user";
import About from "@/pages/about";
import Options from "@/pages/options";
import Profile from "@/pages/profile";
import Rules from "@/pages/rules";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import ResendVerification from "@/pages/resend-verification";
import CreateGame from "@/pages/game/create";
import JoinGame from "@/pages/game/join";
import PlayGame from "@/pages/game/single-play";
import LobbyPage from "@/pages/game/lobby";
import MultiPlayPage from "@/pages/game/multi-play";
import PlayMenu from "@/pages/play";
import Leaderboard from "@/pages/leaderboard";
import DemoGameOver from "@/pages/demo-game-over";
import NotFound from "@/pages/404";

const GEAR_ROUTES: Record<string, string | undefined> = {
   "/user": undefined,
   "/profile": "/profile",
   "/options": "/options",
};

function GearOverlay() {
   const { user } = useAuth();
   const { pathname } = useLocation();

   const isGearPage = pathname in GEAR_ROUTES;
   const show = isGearPage && !!user;

   return (
      <div className={styles.overlay}>
         <div className={styles.overlayMirror}>
            <AnimatePresence>
               {show && (
                  <motion.div
                     key="gear"
                     className={styles.overlayGear}
                     initial={{ opacity: 0, y: -12 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 12 }}
                     transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                     <SettingsGear exclude={GEAR_ROUTES[pathname]} />
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>
   );
}

export default function App() {
   const location = useLocation();

   return (
      <ThemeProvider>
         <AuthProvider>
            <CardStyleProvider>
               <HardLevelProvider>
                  <SoundProvider>
                     <MobileLayoutProvider>
                        <ToastProvider>
                           <div style={{ position: "relative" }}>
                              <AnimatePresence mode="wait">
                                 <motion.div key={location.pathname}>
                                    <Routes location={location}>
                                       <Route path="/" element={<Home />} />
                                       <Route path="/user" element={<User />} />
                                       <Route
                                          path="/about"
                                          element={<About />}
                                       />
                                       <Route
                                          path="/options"
                                          element={<Options />}
                                       />
                                       <Route
                                          path="/profile"
                                          element={<Profile />}
                                       />
                                       <Route
                                          path="/rules"
                                          element={<Rules />}
                                       />
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
                                          path="/play"
                                          element={<PlayMenu />}
                                       />
                                       <Route
                                          path="/leaderboard"
                                          element={<Leaderboard />}
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
                                          path="/game/single-play"
                                          element={<PlayGame />}
                                       />
                                       <Route
                                          path="/game/lobby/:code"
                                          element={<LobbyPage />}
                                       />
                                       <Route
                                          path="/game/multi-play"
                                          element={<MultiPlayPage />}
                                       />
                                       <Route
                                          path="/demo/game-over"
                                          element={<DemoGameOver />}
                                       />
                                       <Route path="*" element={<NotFound />} />
                                    </Routes>
                                 </motion.div>
                              </AnimatePresence>
                              <GearOverlay />
                           </div>
                        </ToastProvider>
                     </MobileLayoutProvider>
                  </SoundProvider>
               </HardLevelProvider>
            </CardStyleProvider>
         </AuthProvider>
      </ThemeProvider>
   );
}
