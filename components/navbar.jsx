import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "@fortawesome/fontawesome-svg-core/styles.css";

import { faUser as fasUser } from "@fortawesome/pro-solid-svg-icons";
import { faUser as farUser } from "@fortawesome/pro-regular-svg-icons";
import { faMoon as fasMoon } from "@fortawesome/pro-solid-svg-icons";
import { faSunBright as fasSunBright } from "@fortawesome/pro-solid-svg-icons";
import { faMusicNote as fasMusicNote } from "@fortawesome/pro-solid-svg-icons";
import { faMusicNoteSlash as fasMusicNoteSlash } from "@fortawesome/pro-solid-svg-icons";
import buttons from "@/styles/buttons.module.css";

export const UserButton = (props) => {
   return (
      <div>
         <FontAwesomeIcon
            className={buttons.icon}
            icon={props.loggedIn ? fasUser : farUser}
         />
      </div>
   );
};

export const NightModeButton = () => {
   const [state, setState] = React.useState(fasMoon);
   const [animation, setAnimation] = React.useState(false);

   const onClickHandler = () => {
      setState(state === fasMoon ? fasSunBright : fasMoon);
      setAnimation(1);
   };

   return (
      <div>
         <FontAwesomeIcon
            onClick={() => onClickHandler()}
            className={buttons.icon}
            icon={state}
            clicked={animation}
            onAnimationEnd={() => setAnimation(0)}
         />
      </div>
   );
};

export const SoundButton = () => {
   const [state, setState] = React.useState(fasMusicNote);
   const [animation, setAnimation] = React.useState(false);

   const onClickHandler = () => {
      setState(state === fasMusicNote ? fasMusicNoteSlash : fasMusicNote);
      setAnimation(1);
   };

   return (
      <div>
         <FontAwesomeIcon
            onClick={() => onClickHandler()}
            className={buttons.icon}
            icon={state}
            clicked={animation}
            onAnimationEnd={() => setAnimation(0)}
         />
      </div>
   );
};
