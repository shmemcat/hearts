import Head from "next/head";
import Link from "next/link";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons";
import { CreateGameSelections } from "@/components/radiobuttons";
import { HeartsLogo } from "@/components/heartslogo";
import { Navbar } from "@/components/navbar";
import { LoginWarning } from "@/components/loginwarning";
import { Tooltip } from "@/components/Tooltip";

export default function CreateGamePage() {
  return (
    <>
      <Head>
        <title>Create Game | Hearts</title>
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
            <h1 style={{ marginTop: "-180px" }}>CREATE GAME</h1>
          </div>

          <div
            className={containers["body-container"]}
            style={{ gap: "20px" }}
          >
            <CreateGameSelections />

            <div style={{ paddingTop: "15px" }}>
              <Tooltip content="Coming soon!">
                <div style={{ display: "inline-block" }}>
                  <Button
                    name="Create Game!"
                    disabled
                    style={{ height: "50px" }}
                  />
                </div>
              </Tooltip>
            </div>
            <LoginWarning />
            <div className={containers["button-container"]}>
              <Link href="/">
                <Button name="Home" style={{ width: "120px" }} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
