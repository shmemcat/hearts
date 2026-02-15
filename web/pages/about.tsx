import Head from "next/head";
import Image from "next/image";
import Link from "next/link";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons";
import { HeartsLogo } from "@/components/heartslogo";
import { Navbar } from "@/components/navbar";
import { Sparkle } from "@/components/sparkle";

export default function About() {
  return (
    <>
      <Head>
        <title>About | Hearts</title>
        <link rel="icon" href="/images/favicon.ico" />
        <meta name="description" content="Hearts web application" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={containers["content-border-container"]}>
        <Navbar />
        <div id="about" className={containers["container"]}>
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
            <h1 style={{ marginTop: "-180px" }}>ABOUT</h1>
          </div>

          <main className={containers["about-body-container"]}>
            <div className={containers["about-text-body"]}>
              <span style={{ margin: "0px" }}>
                Welcome to my <p className="bold">Hearts</p> web app! My name is{" "}
                <p className="bold">Emily</p> aka{" "}
                <p className="bold">
                  <span className="sparkle-container">
                    <Sparkle className="sparkle-svg" />
                    <Sparkle className="sparkle-svg" />
                    <Sparkle className="sparkle-svg" />
                    <Sparkle className="sparkle-svg" />
                    <Sparkle className="sparkle-svg" />
                    <span className="sparkle">shmemcat</span>
                  </span>
                </p>
                . I&apos;m a software engineer developing this web application in
                React and Python. Eventually, you&apos;ll be able to play Hearts
                games locally with AI and online with friends. This has been a
                fun project to work on; it&apos;s been a decade and a half since
                I&apos;ve been immersed in web development (as you can imagine,
                a lot&apos;s changed since then) so learning an array of new
                technologies has been an exceptionally fun challenge. Check out
                my{" "}
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
                <p className="bold">Art of Play</p> playing cards design,{" "}
                <p className="bold">Flourish</p>. Flourish is a delightful
                bakery themed set, which instantly inspired me with its
                whimsical yet balanced design. I&apos;m looking forward to
                making this app a proper tribute to this fantastic deck.
              </span>
              <p>
                For as long as I can remember, my mom played Hearts on Yahoo
                Games when I was growing up. She&apos;s excellent at it, and
                playing with her and her brothers is nothing short of punishing.
                My mom mentioned on more than one occasion how the Hearts apps
                she&apos;s always used have the tendency to be{" "}
                <span style={{ fontSize: "12px" }}>*ahem*</span> homely, so
                I&apos;d love to create for her an aesthetically pleasing
                experience of her favorite card game.
              </p>
              <span>
                <br />
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
                width={300}
                height={200}
                style={{
                  borderRadius: "10px",
                  float: "right",
                  marginBottom: "5px",
                  display: "block",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              />
              <div className="caption">Image courtesy of kardify.com</div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
