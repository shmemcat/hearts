import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { useRouter } from "next/router";
import { useSession, signIn, signOut } from "next-auth/react";

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
            <title>User | Hearts</title>
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
                     USER
                  </h1>
               </div>

               {/* Body */}
               <UserInfo />
            </div>
         </div>
      </>
   );
}

const UserInfo = () => {
   const { data: session, status } = useSession();

   if (session) {
      return (
         <div className={containers["body-container"]}>
            <div>
               <p>Welcome {session.user.email}!</p>
            </div>

            <div className={containers["button-container"]}>
               <Button name="Sign Out" onClick={() => signOut()} />
               <Button name="Back" onClick={() => router.back()} />
               <Link href="/">
                  <Button name="Home" />
               </Link>
            </div>
         </div>
      );
   } else {
      return (
         <div className={containers["body-container"]}>
            <div>
               <p>Please sign in!</p>
            </div>

            <div className={containers["button-container"]}>
               <Button name="Sign In" onClick={() => signIn()} />
               <Button name="Back" onClick={() => router.back()} />
               <Link href="/">
                  <Button name="Home" />
               </Link>
            </div>
         </div>
      );
   }
};
