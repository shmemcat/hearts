import { useState } from "react";

import { Button } from "@/components/Buttons";
import { FormInput } from "@/components/FormInput";
import styles from "./DeleteAccountModal.module.css";

export interface DeleteAccountModalProps {
   onClose: () => void;
   onDelete: (password: string) => Promise<{ error?: string }>;
}

export function DeleteAccountModal({
   onClose,
   onDelete,
}: DeleteAccountModalProps) {
   const [step, setStep] = useState<1 | 2>(1);
   const [password, setPassword] = useState("");
   const [error, setError] = useState("");
   const [loading, setLoading] = useState(false);

   const handleDelete = async () => {
      setError("");
      if (!password) {
         setError("Please enter your password.");
         return;
      }
      setLoading(true);
      const result = await onDelete(password);
      setLoading(false);
      if (result.error) {
         setError(result.error);
      }
   };

   return (
      <div className={styles.backdrop} onClick={onClose}>
         <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {step === 1 ? (
               <>
                  <span className={styles.title}>Delete Account</span>
                  <p className={styles.message}>
                     Are you sure? This will delete all your user data and
                     cannot be undone.
                  </p>
                  <div className={styles.buttons}>
                     <Button name="No" onClick={onClose} />
                     <DangerButton
                        label="Yes"
                        onClick={() => setStep(2)}
                     />
                  </div>
               </>
            ) : (
               <>
                  <span className={styles.title}>Confirm Deletion</span>
                  <p className={styles.message}>
                     Enter your password to permanently delete your account.
                  </p>
                  <div className={styles.passwordInput}>
                     <FormInput
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => {
                           setPassword(e.target.value);
                           if (error) setError("");
                        }}
                        autoComplete="current-password"
                     />
                  </div>
                  {error && <p className={styles.error}>{error}</p>}
                  <div className={styles.buttons}>
                     <Button name="Nevermind" onClick={onClose} />
                     <DangerButton
                        label={loading ? "Deleting…" : "Delete"}
                        onClick={handleDelete}
                        disabled={loading}
                     />
                  </div>
               </>
            )}
         </div>
      </div>
   );
}

function DangerButton({
   label,
   onClick,
   disabled,
}: {
   label: string;
   onClick: () => void;
   disabled?: boolean;
}) {
   return (
      <button
         className={styles.dangerButton}
         onClick={onClick}
         disabled={disabled}
         type="button"
         aria-label={label}
         tabIndex={-1}
      >
         <div className={styles.dangerShine} />
         {label}
      </button>
   );
}
