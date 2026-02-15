import Head from "next/head";
import Link from "next/link";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons";
import { HeartsLogo } from "@/components/heartslogo";
import { Navbar } from "@/components/navbar";
import { LoginWarning } from "@/components/loginwarning";

export default function JoinGamePage() {
  return (
    <>
      <Head>
        <title>Join Game | Hearts</title>
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
            <h1 style={{ marginTop: "-180px" }}>JOIN GAME</h1>
          </div>

          <div className={containers["body-container"]}>
            <h2>Enter the lobby code</h2>
            <p>
              The game host can provide you with a code, or simply visit the game
              lobby link.
            </p>
            <br />
            <div
              style={{
                display: "flex",
                gap: "20px",
                alignItems: "center",
              }}
            >
              <form>
                <input
                  type="text"
                  name="lobby_code"
                  placeholder="Lobby Code"
                  style={{
                    width: "160px",
                    height: "26px",
                    fontWeight: "600",
                  }}
                />
              </form>
              <div title="Coming soon!">
                <Button
                  name="Join"
                  disabled
                  style={{ width: "100px", height: "30px" }}
                />
              </div>
            </div>
            <br />
            <LoginWarning />
            <div
              className={containers["button-container"]}
              style={{ paddingTop: "20px" }}
            >
              <Link href="/">
                <Button name="Back" style={{ width: "150px" }} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
