import { useState } from "react";

import { Button } from "@/components/Buttons";
import styles from "./ActiveGameModal.module.css";

export interface ActiveGameModalProps {
   onContinue: () => void;
   onConcede: () => void;
}

export const ActiveGameModal: React.FC<ActiveGameModalProps> = ({
   onContinue,
   onConcede,
}) => {
   const [confirming, setConfirming] = useState(false);

   return (
      <div className={styles.backdrop}>
         <div className={styles.modal}>
            {!confirming ? (
               <>
                  <span className={styles.title}>Game In Progress</span>
                  <p className={styles.message}>
                     You have a game active. Do you wish to continue playing?
                  </p>
                  <div className={styles.buttons}>
                     <Button name="Continue" onClick={onContinue} />
                     <Button
                        name="Concede"
                        onClick={() => setConfirming(true)}
                     />
                  </div>
               </>
            ) : (
               <>
                  <span className={styles.title}>Are you sure?</span>
                  <p className={styles.message}>
                     Are you sure you wish to concede?
                  </p>
                  <div className={styles.buttons}>
                     <Button name="No" onClick={() => setConfirming(false)} />
                     <Button name="Yes" onClick={onConcede} />
                  </div>
               </>
            )}
         </div>
      </div>
   );
};
