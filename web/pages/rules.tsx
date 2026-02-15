import Head from "next/head";
import Link from "next/link";
import React from "react";
import party from "party-js";

import containers from "@/styles/containers.module.css";
import { RulesButton } from "@/components/buttons";
import { Button } from "@/components/buttons";
import { PageLayout } from "@/components/ui";

export default function RulesPage() {
   return (
      <>
         <Head>
            <title>Rules | Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
            <meta name="description" content="Hearts web application" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
         <PageLayout
            title="RULES"
            className="w-[900px] max-w-[90vw] flex gap-8 max-md:flex-col max-md:items-center max-md:justify-center"
         >
            <Rules />
         </PageLayout>
      </>
   );
}

type RulesState = "overview" | "deal-passing" | "play" | "scoring";

function Rules() {
   const [state, setState] = React.useState<RulesState>("overview");

   const isSelected = (buttonType: RulesState) => state === buttonType;

   return (
      <div className={containers["rules-body-container"]}>
         <div className={`${containers["rules-button-container"]}`}>
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
         <div className={containers["rules-text-body"]}>
            {state === "overview" && <Overview />}
            {state === "deal-passing" && <DealPassing />}
            {state === "play" && <Play />}
            {state === "scoring" && <Scoring />}
            <div>
               <Link href="/">
                  <Button name="Home" />
               </Link>
            </div>
         </div>
      </div>
   );
}

function Overview() {
   return (
      <main className="leading-snug mb-4">
         <h3>Overview</h3>
         <span className="block mb-4">
            Hearts is a trick-taking card game where the players avoid points.
         </span>
         <span className="block mb-4">
            The object of the game is to be the player with the lowest score at
            the end of the game. When one player hits 100 points, the game ends
            and the player with the lowest score wins.
         </span>
      </main>
   );
}

function DealPassing() {
   return (
      <main className="leading-snug mb-4">
         <h3>Deal & Passing</h3>
         <span className="block mb-4">Each player is dealt 13 cards.</span>
         <span className="block mb-4">
            On the first hand, after the deal, each player passes any three
            cards face-down to the player to their left. When passing cards, you
            must first select the cards to be passed and place them face-down,
            ready to be picked up by the receiving player; only then may you
            pick up the cards passed to you, look at them and add them to your
            hand.
         </span>
         <span className="block mb-4">
            On the second hand each player passes three cards to the player to
            their right, in the same way. On the third hand each player passes
            three cards to the player sitting opposite. On the fourth hand no
            cards are passed at all. The cycle then repeats until the end of the
            game.
         </span>
      </main>
   );
}

function Play() {
   return (
      <main className="leading-snug mb-4">
         <h3>The Play</h3>
         <span className="block mb-4">
            Play is clockwise. The player holding the 2 of clubs after the pass
            makes the opening lead.
         </span>
         <span className="block mb-4">
            Each player must follow suit if possible. If a player is void of the
            suit led, a card of any other suit may be discarded. However, if a
            player has no clubs when the first trick is led, a heart or the
            queen of spades cannot be played. The highest card of the suit led
            wins a trick and the winner of that trick leads next. There is no
            trump suit.
         </span>
      </main>
   );
}

function Scoring() {
   return (
      <main className="leading-snug mb-4">
         <h3>Card Values & Scoring</h3>
         <span className="block mb-4">
            At the end of each hand, players count the number of hearts they
            have taken as well as the queen of spades, if applicable. Hearts
            count as one point each and the queen counts 13 points.{" "}
         </span>
         <span className="block mb-4 ml-8">
            Each heart - 1 point <br /> The Queen of Spades - 13 points{" "}
         </span>
         <span className="block mb-4">
            The aggregate total of all scores for each hand must be a multiple
            of 26. The game is played to 100 points. When a player takes all 13
            hearts and the queen of spades in one hand, instead of losing 26
            points, that player scores zero and each of his opponents score an
            additional 26 points. This is colloquially referred to as{" "}
            <span
               className="bold whitespace-nowrap"
               id="shoot-the-moon"
               onMouseOver={(e) =>
                  party.confetti(e.target as HTMLElement, {
                     count: party.variation.range(20, 100),
                  })
               }
            >
               &quot;Shooting the Moon.&quot;
            </span>
         </span>
      </main>
   );
}
