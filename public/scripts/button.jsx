'use strict';

const Button = (props) => {
   const [clicked, setClicked] = React.useState(false);

   return (
      <button 
         onClick={props.onClickDo}
         className="menu-button"
         disabled={props.disabled}
      >{props.name}</button>
   );
};