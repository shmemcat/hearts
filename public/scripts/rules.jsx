'use strict';

const domContainer = document.querySelector('#rules_container');
const root = ReactDOM.createRoot(domContainer);
root.render(
   <div id="rules" className="rules-container">
      {/* Logo */}
      <div>
         <img src="static_assets/images/HeartsLogo.svg" style={{marginTop: "50px"}}/>
         <h1 style={{marginTop: "-180px", marginLeft: "0px"}}>RULES</h1>
      </div>

      {/* Button Menu */}
      <div className="rules-body-container">
         <div className="button-container" style={{marginTop: "90px"}}>
            <Button name="Overview"/>
            <Button name="Deal & Passing"/>
            <Button name="The Play"/>
            <Button name="Scoring" />
            <Button name="Back" onClickDo={()=>{window.location.href="/index.html"}}/>
         </div>
         <div className="rules-body" style={{marginTop: "90px"}}>
            <h2>Overview</h2>
            Hearts is a trick-taking card game where the players avoid points.
            <p></p>
            The object of the game is to be the player with the lowest score at the end of the game. When one player hits 100 points, the game ends; and the player with the lowest score wins.
            </div>
      </div>
   </div>);