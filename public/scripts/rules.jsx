"use strict";

const Rules = (props) => {
   const [state, setState] = React.useState("overview");

   return (
      <div className="rules-body-container">
         <div className="button-container" style={{ marginTop: "90px" }}>
            <Button name="Overview" onClickDo={() => setState("overview")} />
            <Button name="Deal & Passing" onClickDo={() => setState("deal-passing")} />
            <Button name="The Play" onClickDo={() => setState("play")} />
            <Button name="Scoring" onClickDo={() => setState("scoring")} />
            <Button name="Back" onClickDo={() => { window.location.href = "/index.html"; }} />
         </div>
         <div className="rules-body" style={{ marginTop: "90px" }}>
            {state === "overview" && <Overview />}
            {state === "deal-passing" && <DealPassing />}
            {state === "play" && <Play />}
            {state === "scoring" && <Scoring />}
         </div>
      </div>
   );
};

const Overview = () => {
   return (
      <div>
         <h2>Overview</h2>
         <p>Hearts is a trick-taking card game where the players avoid points.</p>
         <p>The object of the game is to be the player with the lowest score at the end of the game.
            When one player hits 100 points, the game ends; and the player with the lowest score wins.</p>
      </div>
   );
};

const DealPassing = () => {
   return (
      <div>
         <h2>Deal & Passing</h2>
         <p>Each player is dealt 13 cards.</p>
         <p>On the first hand, after the deal, each player passes any three cards face-down to the player to their left.
            When passing cards, you must first select the cards to be passed and place them face-down, ready to be picked up by the receiving player;
            only then may you pick up the cards passed to you, look at them and add them to your hand.</p>
         <p>On the second hand each player passes three cards to the player to their right, in the same way.
            On the third hand each player passes three cards to the player sitting opposite. On the fourth hand no cards are passed at all.
            The cycle then repeats until the end of the game.</p>
      </div>
   );
};

const Play = () => {
   return (
      <div>
         <h2>The Play</h2>
         <p>Play is clockwise. The player holding the 2 of clubs after the pass makes the opening lead.</p>
         <p>Each player must follow suit if possible. If a player is void of the suit led, a card of any other suit may be discarded.
            However, if a player has no clubs when the first trick is led, a heart or the queen of spades cannot be played.
            The highest card of the suit led wins a trick and the winner of that trick leads next. There is no trump suit.</p>
      </div>
   );
};

const Scoring = () => {
   return (
      <div>
         <h2>Card Values & Scoring</h2>
         <p>At the end of each hand, players count the number of hearts they have taken as well as the queen of spades, if applicable.
            Hearts count as one point each and the queen counts 13 points. </p>
         <p style={{ marginLeft: "30px" }}>Each heart - 1 point <br /> The Queen of Spades - 13 points </p>
         <p>The aggregate total of all scores for each hand must be a multiple of 26. The game is played to 100 points.
            When a player takes all 13 hearts and the queen of spades in one hand, instead of losing 26 points,
            that player scores zero and each of his opponents score an additional 26 points.
            This is colloquially referred to as <span id="shoot-the-moon"
               onMouseOver={(e) => party.confetti(e.target, { count: party.variation.range(20, 100), })} style={{ color: tan, fontWeight: 700 }}>
               “Shooting the Moon”
            </span>.</p>
      </div>
   );
};

const domContainer = document.querySelector("#rules_container");
const root = ReactDOM.createRoot(domContainer);
root.render(
   <div id="rules" className="rules-container">
      {/* Logo */}
      <div>
         <img src="static_assets/images/HeartsLogo.svg" style={{ marginTop: "50px" }} />
         <h1 style={{ marginTop: "-180px", marginLeft: "0px" }}>RULES</h1>
      </div>

      {/* Button Menu */}
      <Rules />
   </div>);