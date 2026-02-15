import React from "react";
import { useAuth } from "@/context/AuthContext";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle as fasExclamationCircle } from "@fortawesome/pro-solid-svg-icons";
import { StyledLink } from "@/components/StyledLink";

export interface LoginWarningProps {
   className?: string;
}

export const LoginWarning: React.FC<LoginWarningProps> = () => {
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
            <h2>
               <FontAwesomeIcon
                  icon={fasExclamationCircle}
                  className="text-warningicon"
                  shake
               />{" "}
               Pssst
            </h2>
            <span className="block mb-4">
               We noticed you&apos;re not signed in!
            </span>
            <span className="block mb-4">
               If you wish to save your game data, don&apos;t forget to{" "}
               <StyledLink href="/user">sign in.</StyledLink>
            </span>
         </div>
      );
   }
   return <div></div>;
};
