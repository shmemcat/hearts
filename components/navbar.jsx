import React from "react";
import buttons from "@/styles/buttons.module.css";
import { useRouter } from "next/router";
import { useTheme } from "next-themes";
import { useSession, signIn, signOut } from "next-auth/react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { faUser as fasUser } from "@fortawesome/pro-solid-svg-icons";
import { faUser as farUser } from "@fortawesome/pro-regular-svg-icons";
import { faMoon as fasMoon } from "@fortawesome/pro-solid-svg-icons";
import { faSunBright as fasSunBright } from "@fortawesome/pro-solid-svg-icons";
import { faMusicNote as fasMusicNote } from "@fortawesome/pro-solid-svg-icons";
import { faMusicNoteSlash as fasMusicNoteSlash } from "@fortawesome/pro-solid-svg-icons";

export const UserButton = (props) => {
   const [animation, setAnimation] = React.useState(0);
   const { data: session } = useSession();
   const router = useRouter();

   const onClickHandler = () => {
      setAnimation(1);
      if (!session) {
         signIn();
      } else {
         router.push("/user");
      }
   };

   return (
      <div style={{ display: "flex", gap: "10px" }}>
         <div
            role="button"
            aria-label="Login/User Settings"
            onClick={() => onClickHandler()}
         >
            <FontAwesomeIcon
               className={buttons.icon}
               icon={session ? fasUser : farUser}
               clicked={animation}
               onAnimationEnd={() => setAnimation(0)}
            />
         </div>
         <div>{session ? session.user.email : "Guest"}</div>
      </div>
   );
};

export const NightModeButton = () => {
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
            clicked={animation}
            onAnimationEnd={() => setAnimation(0)}
         />
      </div>
   );
};

export const SoundButton = () => {
   const [state, setState] = React.useState(fasMusicNote);
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
            clicked={animation}
            onAnimationEnd={() => setAnimation(0)}
         />
      </div>
   );
};
