import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons.jsx";
import { SelectionButton } from "@/components/buttons.jsx";
import { HeartsLogo } from "@/components/heartslogo.jsx";
import { Navbar } from "@/components/navbar.jsx";
import { LoginWarning } from "@/components/loginwarning";

export default function Home() {
   const router = useRouter();
   return (
      <>
         {/* Header */}
         <Head>
            <title>Create Game | Hearts</title>
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
                  <h1 style={{ marginTop: "-180px" }}>CREATE GAME</h1>
               </div>

               {/* Body */}
               <div
                  className={containers["body-container"]}
                  style={{ gap: "20px" }}
               >
                  <h2>Game Type</h2>
                  <div className={containers["create-button-container"]}>
                     <Button
                        name="Versus AI"
                        active={true}
                        style={{ width: "150px" }}
                     />
                     <Button name="Online" style={{ width: "150px" }} />
                  </div>
                  <h2>AI Difficulty</h2>
                  <div className={containers["create-button-container"]}>
                     <Button name="Easy" style={{ width: "110px" }} />
                     <Button name="Medium" style={{ width: "110px" }} />
                     <Button name="My Mom" style={{ width: "110px" }} />
                  </div>
                  <div style={{ paddingTop: "15px" }}>
                     <Button
                        name="Create Game!"
                        big
                        style={{ height: "50px" }}
                     />
                  </div>
                  <LoginWarning />
                  <div className={containers["button-container"]}>
                     <Button
                        name="Back"
                        style={{ width: "120px" }}
                        onClick={() => router.back()}
                     />
                  </div>
               </div>
            </div>
         </div>
      </>
   );
}
