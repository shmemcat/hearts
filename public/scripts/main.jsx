"use strict";

const domContainer = document.querySelector("#main_container");
const root = ReactDOM.createRoot(domContainer);
root.render(
   <div id="index" className="index-container">
      {/* Logo */}
      <div style={{ width: "100%" }}>
         <img src="static_assets/images/HeartsLogo.svg" style={{ marginTop: "-50px", display: "block", marginLeft: "auto", marginRight: "auto" }} />
         <h1 style={{ marginTop: "-180px" }}>HEARTS</h1>
      </div>

      {/* Button Menu */}
      < div className="button-container">
         <Button name="Log In" disabled />
         <Button name="Create Game" disabled />
         <Button name="Join Game" disabled />
         <Button name="Rules" onClickDo={() => { window.location.href = "/rules.html"; }} />
         <Button name="About" onClickDo={() => { window.location.href = "/about.html"; }} />
      </div >
   </div >);