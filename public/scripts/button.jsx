"use strict";

const Button = (props) => {
   const [clicked, setClicked] = React.useState(false);

   let className = "menu-button";

   return (
      <button
         onClick={props.onClickDo}
         className={className}
         disabled={props.disabled}
      ><ButtonShine /><ButtonShineSmall />{props.name}
      </button >
   );
};

const ButtonShine = () => {
   return (<div className="button-shine"></div>);
};

const ButtonShineSmall = () => {
   return (<div className="button-shine-small"></div>);
};

const RulesButton = (props) => {
   const [clicked, setClicked] = React.useState(false);

   let className = "rules-button";

   if (props.selected) {
      className = "rules-button-selected";
   }

   return (
      <button
         onClick={props.onClickDo}
         className={className}
         disabled={props.disabled}
      >{props.name}
      </button >
   );
};