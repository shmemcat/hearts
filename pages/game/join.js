import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons.jsx";
import { HeartsLogo } from "@/components/heartslogo.jsx";
import { UserButton } from "@/components/navbar.jsx";
import { NightModeButton } from "@/components/navbar.jsx";
import { SoundButton } from "@/components/navbar.jsx";

export default function Home() {
   const router = useRouter();
   return (
      <>
         {/* Header */}
         <Head>
            <title>Join Game | Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
            <meta name="description" content="Hearts web application" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
         <div className={containers["content-border-container"]}>
            {/* Navigation Bar */}
            <div className={containers.nav}>
               <UserButton />
               <NightModeButton />
               <SoundButton />
            </div>
            <div className={containers["container"]}>
               {/* Logo and Title */}
               <div className={containers["title-container"]}>
                  <HeartsLogo
                     style={{
                        marginTop: "30px",
                        display: "block",
                        marginLeft: "auto",
                        marginRight: "auto",
                        userSelect: "none",
                     }}
                  />
                  <h1 style={{ marginTop: "-180px", userSelect: "none" }}>
                     JOIN GAME
                  </h1>
               </div>

               {/* Body */}
               <div className={containers["body-container"]}>
                  <div>Coming soon!</div>
                  <div className={containers["button-container"]}>
                     <Button name="Back" onClick={() => router.back()} />
                  </div>
               </div>
            </div>
         </div>
      </>
   );
}
