import Head from "next/head";
import Link from "next/link";
import React from "react";
import { useSession, signIn, signOut } from "next-auth/react";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons.jsx";
import { HeartsLogo } from "@/components/heartslogo.jsx";
import { Navbar } from "@/components/navbar.jsx";

export default function Home() {
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
            <Navbar />
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
                  <h1 style={{ marginTop: "-180px" }}>USER</h1>
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
            <div>Welcome {session.user.name}!</div>

            <div
               className={containers["button-container"]}
               style={{ paddingTop: "40px" }}
            >
               <Button name="Sign Out" onClick={() => signOut()} />
               <Link href="/">
                  <Button name="Home" />
               </Link>
            </div>
         </div>
      );
   } else {
      return (
         <div className={containers["body-container"]}>
            <div>Please sign in!</div>

            <div
               className={containers["button-container"]}
               style={{ paddingTop: "40px" }}
               title="This used to work when I had a server lol"
            >
               <Button name="Sign In" disabled onClick={() => signIn()} />
               <Link href="/">
                  <Button name="Home" />
               </Link>
            </div>
         </div>
      );
   }
};
