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

   if (!mounted) return null;
   if (status === "loading") return null;

   if (!user) {
      return (
         <div className="mt-4">
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
   return null;
};
