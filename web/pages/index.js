import Head from "next/head";
import Link from "next/link";
import containers from "@/styles/containers.module.css";
import { HeartsLogo } from "@/components/heartslogo.jsx";
import { Button } from "@/components/buttons.jsx";
import { Navbar } from "@/components/navbar.jsx";

export default function Home() {
   return (
      <>
         {/* Header */}
         <Head>
            <title>Hearts</title>
            <link rel="icon" href="/images/favicon.ico" />
            <meta name="description" content="Hearts web application" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
         <main className={containers["content-border-container-menu"]}>
            {/* Navigation Bar */}
            <Navbar />
            <div id="index" className={containers["index-container"]}>
               {/* Logo and Title */}
               <div style={{ display: "flex", flexDirection: "column" }}>
                  <HeartsLogo
                     style={{
                        marginTop: "-100px",
                        display: "block",
                        marginLeft: "auto",
                        marginRight: "auto",
                        userSelect: "none",
                     }}
                  />
                  <h1 style={{ marginTop: "-180px" }}>HEARTS</h1>
               </div>

               {/* Button Menu */}
               <div className={containers["menu-button-container"]}>
                  <Link href="/game/create">
                     <Button name="Create Game" />
                  </Link>
                  <Link href="/game/join">
                     <Button name="Join Game" />
                  </Link>
                  <Link href="/rules">
                     <Button name="Rules" />
                  </Link>
                  <Link href="/about">
                     <Button name="About" />
                  </Link>
               </div>
            </div>
         </main>
      </>
   );
}
