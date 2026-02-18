import Head from "next/head";
import Link from "next/link";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/Buttons";
import { HeartsLogo } from "@/components/HeartsLogo";
import { Navbar } from "@/components/Navbar";
import { motion } from "framer-motion";

export default function Home() {
   return (
      <>
         <Head>
            <title>Hearts</title>
         </Head>
         <main className={containers["content-border-container-menu"]}>
            <Navbar />
            <motion.div
               id="index"
               className={containers["index-container"]}
               initial={{ opacity: 0, y: -12 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 12 }}
               transition={{ duration: 0.25, ease: "easeOut" }}
            >
               <div className={containers["title-container"]}>
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
            </motion.div>
         </main>
      </>
   );
}
