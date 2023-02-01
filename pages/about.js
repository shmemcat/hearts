import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons.jsx";
import { HeartsLogo } from "@/components/heartslogo.jsx";
import { UserButton } from "@/components/navbar.jsx";
import { NightModeButton } from "@/components/navbar.jsx";
import { SoundButton } from "@/components/navbar.jsx";

export default function Home() {
   return (
      <>
         {/* Header */}
         <Head>
            <title>About | Hearts</title>
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
            <div id="about" className={containers["container"]}>
               {/* Logo */}
               <div className={containers["title-container"]}>
                  <HeartsLogo
                     alt="Hearts Logo"
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
                     ABOUT
                  </h1>
               </div>

               {/* Body */}
               <main className={containers["about-body-container"]}>
                  <div className={containers["about-text-body"]}>
                     <span style={{ margin: "0px" }}>
                        Welcome to my <h3>Hearts</h3> web app! My name is{" "}
                        <h3>Emily Tran</h3>, I'm a software engineer developing
                        this web application while learning JavaScript and
                        React. Eventually, you'll be able to play Hearts games
                        locally with AI and online with friends. This has been a
                        fun project to work on; it's been a decade and a half
                        since I've been immersed in web development (as you can
                        imagine, a lot's changed since then) so learning an
                        array of new technologies has been an exceptionally fun
                        challenge. Check out my{" "}
                        <a
                           className="link"
                           target="_blank"
                           href="https://github.com/shmemcat/hearts"
                           rel="noreferrer"
                        >
                           github
                        </a>{" "}
                        to see the code for this project.
                     </span>
                     <span style={{ display: "block", marginTop: "1em" }}>
                        The design of this application is based on the beautiful{" "}
                        <h3>Art of Play</h3> playing cards design,{" "}
                        <h3>Flourish</h3>. Flourish is a delightful bakery
                        themed set, which instantly inspired me with its
                        whimsical yet balanced design. I'm looking forward to
                        making this app a proper tribute to this fantastic deck.
                     </span>
                     <p>
                        For as long as I can remember, my mom played Hearts on
                        Yahoo Games when I was growing up. She's excellent at
                        it, and playing with her and her brothers is nothing
                        short of punishing. My mom mentioned on more than one
                        occasion how the Hearts apps she's always used have the
                        tendency to be{" "}
                        <span style={{ fontSize: "12px" }}>*ahem*</span> homely,
                        so I'd love to create for her an aesthetically pleasing
                        experience of her favorite card game.
                     </p>
                     <span>
                        <br></br>
                        <Link href="/">
                           <Button name="Back" />
                        </Link>
                     </span>
                  </div>
                  <div
                     style={{
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                     }}
                  >
                     <Image
                        alt="Flourish Playing Cards Image"
                        src="/images/Flourish.jpeg"
                        width="300"
                        height="200"
                        style={{
                           borderRadius: "10px",
                           float: "right",
                           marginBottom: "5px",
                           display: "block",
                           marginLeft: "auto",
                           marginRight: "auto",
                        }}
                     />
                     <div className="caption">
                        Image courtesy of kardify.com
                     </div>
                  </div>
               </main>
            </div>
         </div>
      </>
   );
}
