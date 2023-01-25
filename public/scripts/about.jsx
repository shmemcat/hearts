"use strict";

const domContainer = document.querySelector("#about_container");
const root = ReactDOM.createRoot(domContainer);
root.render(
   <div className="content-border-container">
      <div id="about" className="container">
         {/* Logo */}
         <div>
            <img src="static_assets/images/HeartsLogo.svg" style={{ marginTop: "30px" }} />
            <h1 style={{ marginTop: "-180px" }}>ABOUT</h1>
         </div>

         {/* Button Menu */}
         <div className="about-body-container" >
            <div className="about-text-body">
               <span style={{ margin: "0px" }}>
                  Welcome to my <h3>Hearts</h3> app! My name is <h3>Emily Tran</h3>, I'm a software engineer developing this web application while learning JavaScript and React.
                  Eventually, you'll be able to play Hearts games locally with AI and online with friends.
                  This has been a fun project to work on; it's been a decade and a half since I've been immersed into web development (as you can imagine, a lot's changed since then)
                  so learning an array of new technologies has been an exceptionally fun challenge.
               </span>
               <span style={{ display: "block", marginTop: "1em" }}>
                  The design of this application is based on the beautiful <h3>Art of Play</h3> playing cards design, <h3>Flourish</h3>.
                  Flourish is a delightful bakery themed set, which instantly inspired me with its whimsical yet balanced design.
                  I'm looking forward to making this app a proper tribute to this fantastic deck.
               </span>
               <p>
                  For as long as I can remember, my mom played Hearts on Yahoo Games growing up. She's excellent at it, and playing with her and her brothers is nothing short of punishing.
                  My mom mentioned on more than one occasion how the Hearts apps she's always used have the tendency to be <span style={{ fontSize: "12px" }}>*ahem*</span> homely, so I'd love to create for her an aesthetically pleasing experience of her favorite card game.
               </p>
               <span>
                  <br></br>
                  <Button name="Back" onClickDo={() => { window.location.href = "/index.html"; }} />
               </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
               <img src="static_assets/images/Flourish.jpeg" style={{ width: "300px", borderRadius: "10px", float: "right", marginBottom: "5px", display: "block", marginLeft: "auto", marginRight: "auto" }} />
               <div className="caption">Image courtesy of kardify.com</div>
            </div>
         </div>
      </div>
   </div >);