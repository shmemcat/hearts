import React from "react";
import Link from "next/link";
import buttons from "@/styles/buttons.module.css";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/router";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { faUser as farUser } from "@fortawesome/pro-regular-svg-icons";
import {
   faUser as fasUser,
   faMoon as fasMoon,
   faSunBright as fasSunBright,
   faMusicNote as fasMusicNote,
   faMusicNoteSlash as fasMusicNoteSlash,
   faHeart as fasHeart,
} from "@fortawesome/pro-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/** Props passed to FontAwesomeIcon for icon-select-bounce (CSS .icon[clicked="1"]) */
interface IconAnimationProps {
   clicked: number;
   onAnimationEnd: () => void;
}

export const Navbar: React.FC = () => {
   const router = useRouter();
   return (
      <div className="flex flex-row justify-between">
         {router.pathname === "/" ? (
            <div />
         ) : (
            <Link href="/" className="no-underline">
               <div id="nav-home" className="flex gap-[15px] items-center">
                  <FontAwesomeIcon className="icon" icon={fasHeart} />{" "}
                  <span className="navhearts">HEARTS</span>
               </div>
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

   const onClickHandler = () => {
      setAnimation(1);
   };

   return (
      <Link href="/user" className="no-underline">
         <div id="nav-home" className="flex gap-2.5">
            <div
               role="button"
               aria-label="Login/User Settings"
               onClick={() => onClickHandler()}
            >
               <FontAwesomeIcon
                  className="icon"
                  icon={user ? fasUser : farUser}
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

const SoundButton: React.FC = () => {
   const [state, setState] = React.useState<IconDefinition>(fasMusicNote);
   const [animation, setAnimation] = React.useState(0);

   const onClickHandler = () => {
      setState(state === fasMusicNote ? fasMusicNoteSlash : fasMusicNote);
      setAnimation(1);
   };

   return (
      <div
         role="button"
         aria-label="Toggle sound on or off"
         onClick={() => onClickHandler()}
      >
         <FontAwesomeIcon
            className={buttons.icon}
            icon={state}
            {...({
               clicked: animation,
               onAnimationEnd: () => setAnimation(0),
            } as IconAnimationProps)}
         />
      </div>
   );
};
