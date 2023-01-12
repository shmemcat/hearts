'use strict';

const domContainer = document.querySelector('#main_container');
const root = ReactDOM.createRoot(domContainer);
root.render(
   <div id="index" className="index-container">
      {/* Logo */}
      <div>
         <img src="static_assets/images/HeartsLogo.svg" style={{marginTop: "-50px"}}/>
         <h1 style={{marginTop: "-180px", marginLeft: "-30px"}}>HEARTS</h1>
      </div>

      {/* Button Menu */}
      <div className="button-container" style={{marginTop: "10px", marginLeft: "200px"}}>
         <Button name="Log In" disabled/>
         <Button name="Create Game" disabled/>
         <Button name="Join Game" disabled/>
         <Button name="Rules" onClickDo={()=>{window.location.href="/rules.html"}}/>
         <Button name="About" disabled/>
      </div>
   </div>);