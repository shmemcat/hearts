import React from "react";
import { Link, useLocation } from "react-router-dom";
import buttons from "@/styles/buttons.module.css";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useSound } from "@/context/SoundContext";
import { useToast } from "@/context/ToastContext";
import { unlockAchievement } from "@/lib/gameApi";
import { resolveUnlockId } from "@/lib/achievements";

import { useNavigate } from "react-router-dom";
import { motion, useAnimationControls } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { faUser as farUser } from "@fortawesome/pro-regular-svg-icons";
import {
   faMoon as fasMoon,
   faSunBright as fasSunBright,
   faMusicNote as fasMusicNote,
   faMusicNoteSlash as fasMusicNoteSlash,
   faVolume as fasVolume,
   faVolumeSlash as fasVolumeSlash,
   faMusic as fasMusic,
   faMusicSlash as fasMusicSlash,
} from "@fortawesome/pro-solid-svg-icons";
import { HeartIcon } from "@/components/game";
import { getProfileIcon } from "@/lib/profileIcons";

/** Props passed to FontAwesomeIcon for icon-select-bounce (CSS .icon[clicked="1"]) */
interface IconAnimationProps {
   clicked: number;
   onAnimationEnd: () => void;
}

const FADE_IN_ROUTES = new Set([
   "/user",
   "/profile",
   "/game/create",
   "/game/join",
   "/about",
   "/rules",
]);

let previousPath = "/";
let _fadeOutLogo: (() => void) | null = null;

/** Call before navigating to "/" to fade out the navbar HEARTS logo. */
export function triggerLogoFadeOut() {
   _fadeOutLogo?.();
}

export const Navbar: React.FC = () => {
   const location = useLocation();
   const navigate = useNavigate();
   const logoControls = useAnimationControls();

   const cameFromHome = previousPath === "/";
   const shouldFadeIn = FADE_IN_ROUTES.has(location.pathname) && cameFromHome;

   React.useEffect(() => {
      if (location.pathname !== "/") {
         logoControls.start({
            opacity: 1,
            transition: shouldFadeIn
               ? { duration: 0.3, ease: "easeOut", delay: 0.15 }
               : { duration: 0 },
         });
         _fadeOutLogo = () => {
            logoControls.start({
               opacity: 0,
               transition: { duration: 0.2, ease: "easeOut" },
            });
         };
      }
      return () => {
         previousPath = location.pathname;
         _fadeOutLogo = null;
      };
   }, [location.pathname]);

   const handleHomeClick = (e: React.MouseEvent) => {
      e.preventDefault();
      triggerLogoFadeOut();
      navigate("/");
   };

   return (
      <div className="flex flex-row justify-between">
         {location.pathname === "/" ? (
            <div />
         ) : (
            <Link to="/" className="no-underline" onClick={handleHomeClick}>
               <motion.div
                  id="nav-home"
                  className="flex gap-[12px] items-center"
                  initial={shouldFadeIn ? { opacity: 0 } : false}
                  animate={logoControls}
               >
                  <span className="icon">
                     <HeartIcon size={18} />
                  </span>{" "}
                  <span className="navhearts">HEARTS</span>
               </motion.div>
            </Link>
         )}
         <div className="flex justify-end flex-row-reverse gap-5">
            <UserButton />
            <NightModeButton />
            <SoundButton />
         </div>
      </div>
   );
};

const UserButton: React.FC = () => {
   const [animation, setAnimation] = React.useState(0);
   const { user } = useAuth();

   const icon = user ? getProfileIcon(user.profile_icon) : farUser;

   const onClickHandler = () => {
      setAnimation(1);
   };

   return (
      <Link to="/user" className="no-underline">
         <div id="nav-home" className="flex gap-2.5">
            <div
               role="button"
               aria-label="Login/User Settings"
               onClick={() => onClickHandler()}
            >
               <FontAwesomeIcon
                  className="icon"
                  icon={icon}
                  {...({
                     clicked: animation,
                     onAnimationEnd: () => setAnimation(0),
                  } as IconAnimationProps)}
               />
            </div>
            <div className="navtext">
               {user?.name ?? user?.email ?? "Guest"}
            </div>
         </div>
      </Link>
   );
};

const NightModeButton: React.FC = () => {
   const [animation, setAnimation] = React.useState(0);
   const { resolvedTheme, setTheme } = useTheme();
   const [mounted, setMounted] = React.useState(false);

   React.useEffect(() => {
      setMounted(true);
   }, []);

   if (!mounted) return <></>;

   const onClickHandler = () => {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
      setAnimation(1);
   };

   return (
      <div
         role="button"
         aria-label="Toggle between light and dark mode"
         onClick={() => onClickHandler()}
      >
         <FontAwesomeIcon
            className={buttons.icon}
            icon={resolvedTheme === "dark" ? fasMoon : fasSunBright}
            {...({
               clicked: animation,
               onAnimationEnd: () => setAnimation(0),
            } as IconAnimationProps)}
         />
      </div>
   );
};

let _geezerFired = false;

const SoundButton: React.FC = () => {
   const {
      muted,
      setMuted,
      volume,
      setVolume,
      play,
      musicMuted,
      setMusicMuted,
      musicVolume,
      setMusicVolume,
   } = useSound();
   const { token } = useAuth();
   const { addToast } = useToast();
   const [animation, setAnimation] = React.useState(0);
   const [mounted, setMounted] = React.useState(false);
   const [modalOpen, setModalOpen] = React.useState(false);
   const wrapRef = React.useRef<HTMLDivElement>(null);

   React.useEffect(() => {
      setMounted(true);
   }, []);

   React.useEffect(() => {
      if (!modalOpen) return;
      const handler = (e: PointerEvent) => {
         if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
            setModalOpen(false);
         }
      };
      document.addEventListener("pointerdown", handler);
      return () => document.removeEventListener("pointerdown", handler);
   }, [modalOpen]);

   const fireGeezer = React.useCallback(() => {
      if (!token || _geezerFired) return;
      _geezerFired = true;
      unlockAchievement(token, "geezer").then((res) => {
         if (!res.ok || res.newly_unlocked.length === 0) return;
         for (const id of res.newly_unlocked) {
            const info = resolveUnlockId(id);
            if (info) {
               addToast({
                  achievementId: id,
                  name: info.name,
                  icon: <FontAwesomeIcon icon={info.def.icon} />,
                  tier: info.tier,
               });
            }
         }
      });
   }, [token, addToast]);

   if (!mounted) return <></>;

   const allMuted = muted && musicMuted;

   const onClickHandler = () => {
      setAnimation(1);
      setModalOpen((prev) => !prev);
   };

   const onSoundToggle = () => {
      const willUnmute = muted;
      setMuted(!muted);
      if (willUnmute) {
         setTimeout(() => play("soundOn"), 50);
      } else if (musicMuted) {
         fireGeezer();
      }
   };

   const onSoundVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      setVolume(v);
      if (v === 0 && !muted) {
         setMuted(true);
         if (musicMuted) fireGeezer();
      } else if (v > 0 && muted) {
         setMuted(false);
      }
   };

   const onMusicToggle = () => {
      const willUnmute = musicMuted;
      setMusicMuted(!musicMuted);
      if (willUnmute && musicVolume === 0) {
         setMusicVolume(0.15);
      } else if (!willUnmute && muted) {
         fireGeezer();
      }
   };

   const onMusicVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      setMusicVolume(v);
      if (v === 0 && !musicMuted) {
         setMusicMuted(true);
         if (muted) fireGeezer();
      } else if (v > 0 && musicMuted) {
         setMusicMuted(false);
      }
   };

   return (
      <div
         ref={wrapRef}
         className={buttons.soundButtonWrap}
         data-modal-open={modalOpen}
      >
         <div
            role="button"
            aria-label="Sound and music settings"
            onClick={onClickHandler}
         >
            <FontAwesomeIcon
               className={buttons.icon}
               icon={allMuted ? fasMusicNoteSlash : fasMusicNote}
               {...({
                  clicked: animation,
                  onAnimationEnd: () => setAnimation(0),
               } as IconAnimationProps)}
            />
         </div>
         <div className={buttons.volumeModalDrop}>
            <div className={buttons.volumeModalInner}>
               <div className={buttons.volumeRow}>
                  <div
                     role="button"
                     aria-label="Toggle sound effects"
                     onClick={onSoundToggle}
                     className={buttons.volumeRowIcon}
                  >
                     <FontAwesomeIcon
                        icon={muted ? fasVolumeSlash : fasVolume}
                     />
                  </div>
                  <input
                     type="range"
                     min={0}
                     max={1}
                     step={0.01}
                     value={volume}
                     onChange={onSoundVolumeChange}
                     className={buttons.volumeSlider}
                     aria-label="Sound effects volume"
                  />
               </div>
               <div className={buttons.volumeRow}>
                  <div
                     role="button"
                     aria-label="Toggle music"
                     onClick={onMusicToggle}
                     className={buttons.volumeRowIcon}
                  >
                     <FontAwesomeIcon
                        icon={musicMuted ? fasMusicSlash : fasMusic}
                     />
                  </div>
                  <input
                     type="range"
                     min={0}
                     max={1}
                     step={0.01}
                     value={musicVolume}
                     onChange={onMusicVolumeChange}
                     className={buttons.volumeSlider}
                     aria-label="Music volume"
                  />
               </div>
            </div>
         </div>
      </div>
   );
};
