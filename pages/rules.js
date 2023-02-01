import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import party from "party-js";

import containers from "@/styles/containers.module.css";
import { RulesButton } from "@/components/buttons.jsx";
import { HeartsLogo } from "@/components/heartslogo.jsx";
import { Button } from "@/components/buttons.jsx";
import { UserButton } from "@/components/navbar.jsx";
import { NightModeButton } from "@/components/navbar.jsx";
import { SoundButton } from "@/components/navbar.jsx";

export default function Home() {
   return (
      <>
         {/* Header */}
         <Head>
            <title>Rules | Hearts ♥</title>
            <meta name="description" content="Hearts web application" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
         {/* Navigation Bar */}
         <div className={containers["content-border-container"]}>
            <div className={containers.nav}>
               <Link href="/login">
                  <UserButton loggedIn={false} />
               </Link>
               <NightModeButton />
               <SoundButton />
            </div>
            <div id="rules" className={containers["container"]}>
               {/* Logo */}
               <div style={{ display: "flex", flexDirection: "column" }}>
                  <HeartsLogo
                     width="250"
                     height="250"
                     style={{
                        marginTop: "30px",
                        display: "block",
                        marginLeft: "auto",
                        marginRight: "auto",
                        userSelect: "none",
                     }}
                  />
                  <h1 style={{ marginTop: "-180px", userSelect: "none" }}>
                     RULES
                  </h1>
               </div>

               {/* Button Menu & Rules Flexbox */}
               <Rules />
            </div>
         </div>
      </>
   );
}

/* Rules React Component to handle states */
const Rules = () => {
   const [state, setState] = React.useState("overview");

   // if the button's text blurb is showing, set the button to "selected"
   const isSelected = (buttonType) => {
      return state === buttonType;
   };

   return (
      <div className={containers["rules-body-container"]}>
         {/* Button Menu */}
         <div className={containers["rules-button-container"]}>
            <RulesButton
               name="Overview"
               selected={isSelected("overview")}
               onClick={() => setState("overview")}
            />
            <RulesButton
               name="Deal & Passing"
               selected={isSelected("deal-passing")}
               onClick={() => setState("deal-passing")}
            />
            <RulesButton
               name="The Play"
               selected={isSelected("play")}
               onClick={() => setState("play")}
            />
            <RulesButton
               name="Scoring"
               selected={isSelected("scoring")}
               onClick={() => setState("scoring")}
            />
         </div>
         {/* Rules body with different states */}
         <div className={containers["rules-text-body"]}>
            {state === "overview" && <Overview />}
            {state === "deal-passing" && <DealPassing />}
            {state === "play" && <Play />}
            {state === "scoring" && <Scoring />}
            <div>
               <Link href="/">
                  <Button name="Back" />
               </Link>
            </div>
         </div>
      </div>
   );
};

/* React Component for Overview */
const Overview = () => {
   return (
      <main>
         <h2>Overview</h2>
         <p>
            Hearts is a trick-taking card game where the players avoid points.
         </p>
         <p>
            The object of the game is to be the player with the lowest score at
            the end of the game. When one player hits 100 points, the game ends
            and the player with the lowest score wins.
         </p>
      </main>
   );
};

/* React Component for Deal & Passing */
const DealPassing = () => {
   return (
      <main>
         <h2>Deal & Passing</h2>
         <p>Each player is dealt 13 cards.</p>
         <p>
            On the first hand, after the deal, each player passes any three
            cards face-down to the player to their left. When passing cards, you
            must first select the cards to be passed and place them face-down,
            ready to be picked up by the receiving player; only then may you
            pick up the cards passed to you, look at them and add them to your
            hand.
         </p>
         <p>
            On the second hand each player passes three cards to the player to
            their right, in the same way. On the third hand each player passes
            three cards to the player sitting opposite. On the fourth hand no
            cards are passed at all. The cycle then repeats until the end of the
            game.
         </p>
      </main>
   );
};

/* React Component for Play */
const Play = () => {
   return (
      <main>
         <h2>The Play</h2>
         <p>
            Play is clockwise. The player holding the 2 of clubs after the pass
            makes the opening lead.
         </p>
         <p>
            Each player must follow suit if possible. If a player is void of the
            suit led, a card of any other suit may be discarded. However, if a
            player has no clubs when the first trick is led, a heart or the
            queen of spades cannot be played. The highest card of the suit led
            wins a trick and the winner of that trick leads next. There is no
            trump suit.
         </p>
      </main>
   );
};

/* React Component for Scoring, including a confetti surprise */
const Scoring = () => {
   return (
      <main>
         <h2>Card Values & Scoring</h2>
         <p>
            At the end of each hand, players count the number of hearts they
            have taken as well as the queen of spades, if applicable. Hearts
            count as one point each and the queen counts 13 points.{" "}
         </p>
         <p style={{ marginLeft: "30px" }}>
            Each heart - 1 point <br /> The Queen of Spades - 13 points{" "}
         </p>
         <span>
            <span>
               The aggregate total of all scores for each hand must be a
               multiple of 26. The game is played to 100 points. When a player
               takes all 13 hearts and the queen of spades in one hand, instead
               of losing 26 points, that player scores zero and each of his
               opponents score an additional 26 points. This is colloquially
               referred to as{" "}
               <h3
                  id="shoot-the-moon"
                  onMouseOver={(e) =>
                     party.confetti(e.target, {
                        count: party.variation.range(20, 100),
                     })
                  }
                  style={{ whiteSpace: "nowrap" }}
               >
                  “Shooting the Moon.”
               </h3>
            </span>
         </span>
      </main>
   );
};
