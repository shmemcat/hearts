import React from "react";
import { useSession, signIn } from "next-auth/react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle as fasExclamationCircle } from "@fortawesome/pro-solid-svg-icons";

export const LoginWarning = () => {
   const { data: session, status } = useSession();
   const [mounted, setMounted] = React.useState(false);

   React.useEffect(() => {
      setMounted(true);
   }, []);

   if (!mounted) return <></>;

   if (!session) {
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
            <p>We noticed you're not signed in!</p>
            <p>
               If you wish to save your game data, don't forget to{" "}
               <span className="link" onClick={() => signIn()}>
                  sign in.
               </span>
            </p>
         </div>
      );
   } else {
      return <div></div>;
   }
};
