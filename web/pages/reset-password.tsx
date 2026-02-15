import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import containers from "@/styles/containers.module.css";
import { Button } from "@/components/buttons";
import { HeartsLogo } from "@/components/heartslogo";
import { Navbar } from "@/components/navbar";
import { StyledLink } from "@/components/StyledLink";

const MIN_PASSWORD_LEN = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!token || typeof token !== "string") {
      setError("Invalid reset link");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || "Reset failed");
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>Reset password | Hearts</title>
        <link rel="icon" href="/images/favicon.ico" />
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
            <h1 style={{ marginTop: "-180px" }}>RESET PASSWORD</h1>
          </div>
          <div className={containers["body-container"]}>
            {success ? (
              <p style={{ color: "var(--heartslogo, green)" }}>
                Password updated. You can sign in now.
              </p>
            ) : (
              <>
                <p>Enter your new password.</p>
                <form
                  onSubmit={handleSubmit}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    maxWidth: "280px",
                    marginTop: "20px",
                  }}
                >
                  <input
                    type="password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={MIN_PASSWORD_LEN}
                    autoComplete="new-password"
                    style={{ padding: "8px 12px" }}
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={MIN_PASSWORD_LEN}
                    autoComplete="new-password"
                    style={{ padding: "8px 12px" }}
                  />
                  {error && (
                    <span
                      style={{
                        color: "var(--warningicon, #c00)",
                        fontSize: "14px",
                      }}
                    >
                      {error}
                    </span>
                  )}
                  <Button
                    name={loading ? "Updating…" : "Update password"}
                    disabled={loading}
                    onClick={() => {}}
                  />
                </form>
              </>
            )}
            <div style={{ marginTop: "16px" }}>
              <StyledLink href="/user">Back to sign in</StyledLink>
            </div>
            <div
              className={containers["button-container"]}
              style={{ paddingTop: "24px" }}
            >
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
