import React from "react";
import { useAuth } from "@/context/AuthContext";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle as fasExclamationCircle } from "@fortawesome/pro-solid-svg-icons";
import { StyledLink } from "@/components/StyledLink";

export const LoginWarning: React.FC = () => {
  const { user, status } = useAuth();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <></>;
  if (status === "loading") return <></>;

  if (!user) {
    return (
      <div>
        <p>
          <h2>
            <FontAwesomeIcon
              icon={fasExclamationCircle}
              style={{ color: "var(--warningicon)" }}
              shake
            />{" "}
            Pssst
          </h2>
        </p>
        <p>We noticed you&apos;re not signed in!</p>
        <p>
          If you wish to save your game data, don&apos;t forget to{" "}
          <StyledLink href="/user">sign in.</StyledLink>
        </p>
      </div>
    );
  }
  return <div></div>;
};
