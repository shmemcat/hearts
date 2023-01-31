import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser as fasUser } from "@fortawesome/pro-solid-svg-icons";
import { faUser as farUser } from "@fortawesome/pro-regular-svg-icons";
import { faMoon as fasMoon } from "@fortawesome/pro-solid-svg-icons";
import { faSun as fasSun } from "@fortawesome/pro-solid-svg-icons";
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

   return (
      <div>
         <FontAwesomeIcon
            onClick={() => setState(state === fasMoon ? fasSun : fasMoon)}
            className={buttons.icon}
            icon={state}
         />
      </div>
   );
};

export const SoundButton = () => {
   const [state, setState] = React.useState(fasMusicNote);

   return (
      <div>
         <FontAwesomeIcon
            onClick={() =>
               setState(
                  state === fasMusicNote ? fasMusicNoteSlash : fasMusicNote
               )
            }
            className={buttons.icon}
            icon={state}
         />
      </div>
   );
};
