import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import containers from "@/styles/containers.module.css";
import buttons from "@/styles/buttons.module.css";
import { Button } from "@/components/buttons.jsx";
import { UserButton } from "@/components/navbar.jsx";
import { NightModeButton } from "@/components/navbar.jsx";
import { SoundButton } from "@/components/navbar.jsx";

export default function Home() {
   return (
      <>
         <Head>
            <title>Hearts ♥</title>
            <meta name="description" content="Hearts web application" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1"
            />
         </Head>
         <main className={containers["content-border-container-menu"]}>
            <div className={containers.nav}>
               <Link href="/login">
                  <UserButton loggedIn={false} />
               </Link>
               <NightModeButton />
               <SoundButton />
            </div>
            <div id="index" className={containers["index-container"]}>
               {/* Logo */}
               <div>
                  <Image
                     alt="Hearts Logo"
                     src="/images/HeartsLogo.svg"
                     width="250"
                     height="250"
                     style={{
                        marginTop: "-100px",
                        display: "block",
                        marginLeft: "auto",
                        marginRight: "auto",
                     }}
                  />
                  <h1 style={{ marginTop: "-180px" }}>HEARTS</h1>
               </div>

               {/* Button Menu */}
               <div className={containers["button-container"]}>
                  <Button name="Create Game" disabled />
                  <Button name="Join Game" disabled />
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
