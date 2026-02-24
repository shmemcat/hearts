import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/Buttons";
import styles from "./ActiveGameModal.module.css";

export interface ActiveGameModalProps {
   onContinue: () => void;
   onConcede: () => void;
   title?: ReactNode;
   message?: string;
   continueLabel?: string;
   concedeLabel?: string;
   confirmMessage?: string;
}

export const ActiveGameModal: React.FC<ActiveGameModalProps> = ({
   onContinue,
   onConcede,
   title = "Game In Progress",
   message = "You have a game active. Do you wish to continue playing?",
   continueLabel = "Continue",
   concedeLabel = "Concede",
   confirmMessage = "Are you sure you wish to concede?",
}) => {
   const [confirming, setConfirming] = useState(false);

   return (
      <div className={styles.backdrop}>
         <div className={styles.modal}>
            {!confirming ? (
               <>
                  <span className={styles.title}>{title}</span>
                  <p className={styles.message}>{message}</p>
                  <div className={styles.buttons}>
                     <Button name={continueLabel} onClick={onContinue} />
                     <Button
                        name={concedeLabel}
                        onClick={() => setConfirming(true)}
                     />
                  </div>
               </>
            ) : (
               <>
                  <span className={styles.title}>Are you sure?</span>
                  <p className={styles.message}>{confirmMessage}</p>
                  <div className={styles.buttons}>
                     <Button name="Yes" onClick={onConcede} />
                     <Button name="No" onClick={() => setConfirming(false)} />
                  </div>
               </>
            )}
         </div>
      </div>
   );
};
