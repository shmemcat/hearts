import Head from "next/head";
import Link from "next/link";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons";
import { HeartsLogo } from "@/components/heartslogo";
import { Navbar } from "@/components/navbar";

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 | Hearts</title>
        <link rel="icon" href="/images/favicon.ico" />
        <meta name="description" content="Hearts web application" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={containers["content-border-container"]}>
        <Navbar />
        <div className={containers["container"]}>
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
            <h1 style={{ marginTop: "-180px" }}>404</h1>
          </div>

          <div className={containers["body-container"]}>
            <div>Page not found!</div>
            <div className={containers["button-container"]}>
              <Link href="/">
                <Button name="Home" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
