import Head from "next/head";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/Buttons";
import { Sparkle } from "@/components/Sparkle";
import { StyledLink } from "@/components/StyledLink";
import { PageLayout } from "@/components/ui";

export default function About() {
   return (
      <>
         <Head>
            <title>About | Hearts</title>
         </Head>
         <PageLayout
            title="ABOUT"
            className="mt-8 w-[90vw] max-w-[900px] flex flex-row gap-10 items-start max-md:flex-col-reverse max-md:items-center sm:mt-10"
         >
            <div className="flex-1 min-w-0 text-base tracking-[1.5px] leading-snug ml-2.5 max-md:mx-5 max-md:text-center">
               <span className="m-0 block mb-4">
                  Welcome to my <span className="bold">Hearts</span> web app! My
                  name is <span className="bold">Emily</span> aka{" "}
                  <span className="bold">
                     <span className="sparkle-container">
                        <Sparkle className="sparkle-svg" />
                        <Sparkle className="sparkle-svg" />
                        <Sparkle className="sparkle-svg" />
                        <Sparkle className="sparkle-svg" />
                        <Sparkle className="sparkle-svg" />
                        <span className="sparkle">shmemcat</span>
                     </span>
                  </span>
                  . I&apos;m a software engineer developing this web application
                  in React and Python. Eventually, you&apos;ll be able to play
                  Hearts games locally with AI and online with friends. This has
                  been a fun project to work on; it&apos;s been a decade and a
                  half since I&apos;ve been immersed in web development (as you
                  can imagine, a lot&apos;s changed since then) so learning an
                  array of new technologies has been an exceptionally fun
                  challenge. Check out my{" "}
                  <StyledLink
                     href="https://github.com/shmemcat/hearts"
                     target="_blank"
                     rel="noreferrer"
                  >
                     github
                  </StyledLink>{" "}
                  to see the code for this project.
               </span>
               <span className="block mt-4">
                  The design of this application is based on the beautiful{" "}
                  <span className="bold">Art of Play</span> playing cards
                  design, <span className="bold">Flourish</span>. Flourish is a
                  delightful bakery themed set, which instantly inspired me with
                  its whimsical yet balanced design. I&apos;m looking forward to
                  making this app a proper tribute to this fantastic deck.
               </span>
               <span className="block mt-4">
                  For as long as I can remember, my mom played Hearts on Yahoo
                  Games when I was growing up. She&apos;s excellent at it, and
                  playing with her and her brothers is nothing short of
                  punishing. My mom mentioned on more than one occasion how the
                  Hearts apps she&apos;s always used have the tendency to be{" "}
                  <span className="text-xs">*ahem*</span> homely, so I&apos;d
                  love to create for her an aesthetically pleasing experience of
                  her favorite card game.
               </span>
               <span className="block pt-4">
                  <br />
                  <Link href="/">
                     <Button name="Home" />
                  </Link>
               </span>
            </div>
            <div className="flex flex-col items-center justify-center w-[300px] max-w-[420px] max-md:w-full relative">
               <Image
                  alt="Flourish Playing Cards Image"
                  src="/images/Flourish.jpeg"
                  width={300}
                  height={200}
                  className="rounded-[10px] block"
               />
               <div className="mt-1 text-xs tracking-[1pt] py-1.5">
                  Image courtesy of kardify.com
               </div>
            </div>
         </PageLayout>
      </>
   );
}
