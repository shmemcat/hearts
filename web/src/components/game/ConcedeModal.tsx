import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/pro-solid-svg-icons";

import { Button } from "@/components/Buttons";
import styles from "./ConcedeModal.module.css";

export interface ConcedeModalProps {
   onClose: () => void;
   onConcede: () => void;
}

export const ConcedeModal: React.FC<ConcedeModalProps> = ({
   onClose,
   onConcede,
}) => {
   const [step, setStep] = useState<1 | 2>(1);

   return (
      <div className={styles.backdrop} onClick={onClose}>
         <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {step === 1 ? (
               <>
                  <span className={styles.title}>Concede</span>
                  <p className={styles.message}>
                     Do you wish to concede this game?
                  </p>
                  <div className={styles.buttons}>
                     <Button name="Continue" onClick={onClose} />
                     <Button
                        name="Concede"
                        onClick={() => setStep(2)}
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
                     <Button name="No" onClick={() => setStep(1)} />
                     <Button name="Yes" onClick={onConcede} />
                  </div>
               </>
            )}
         </div>
      </div>
   );
};

export interface ConcedeButtonProps {
   onClick: () => void;
}

export const ConcedeButton: React.FC<ConcedeButtonProps> = ({ onClick }) => {
   return (
      <button
         type="button"
         className={styles.concedeBtn}
         onClick={onClick}
         aria-label="Concede game"
      >
         <FontAwesomeIcon icon={faXmark} />
      </button>
   );
};
