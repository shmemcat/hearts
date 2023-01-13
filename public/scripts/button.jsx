"use strict";

const Button = (props) => {
   const [clicked, setClicked] = React.useState(false);

   let className = "menu-button";

   if (props.selected) {
      className = "menu-button-selected";
   }

   return (
      <button
         onClick={props.onClickDo}
         className={className}
         disabled={props.disabled}
      >{props.name}</button>
   );
};