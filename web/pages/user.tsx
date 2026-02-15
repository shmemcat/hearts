import Head from "next/head";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons";
import { HeartsLogo } from "@/components/heartslogo";
import { Navbar } from "@/components/navbar";

export default function UserPage() {
  return (
    <>
      <Head>
        <title>User | Hearts</title>
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
            <h1 style={{ marginTop: "-180px" }}>USER</h1>
          </div>

          <UserInfo />
        </div>
      </div>
    </>
  );
}

function UserInfo() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className={containers["body-container"]}>
        <div>Welcome {session.user?.name}!</div>

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
  }
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
