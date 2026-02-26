import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
   faCircleCheck,
   faTriangleExclamation,
} from "@fortawesome/pro-solid-svg-icons";

import { Button } from "@/components/Buttons";
import { FormInput } from "@/components/FormInput";
import { StyledLink } from "@/components/StyledLink";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/api";
import {
   PROFILE_ICONS,
   PROFILE_ICON_CATEGORIES,
   getProfileIcon,
} from "@/lib/profileIcons";
import styles from "@/styles/profile.module.css";

export default function ProfilePage() {
   return (
      <>
         <Helmet>
            <title>Profile | Hearts</title>
         </Helmet>
         <PageLayout title="PROFILE">
            <ProfileContent />
         </PageLayout>
      </>
   );
}

function ProfileContent() {
   const { user, token, status, updateUser } = useAuth();

   if (status === "loading") {
      return <div className="mt-8">Loading…</div>;
   }

   if (!user || !token) {
      return (
         <div className="mt-8 flex flex-col items-center gap-4">
            <div>Sign in to customize your profile.</div>
            <Link to="/user">
               <Button name="Sign In" />
            </Link>
         </div>
      );
   }

   return (
      <>
         <IconPickerSection
            currentIcon={user.profile_icon ?? "user"}
            token={token}
            onIconChange={(icon) => updateUser({ profile_icon: icon })}
         />
         <EmailSection
            currentEmail={user.email}
            emailVerified={user.email_verified ?? false}
            token={token}
            onEmailChange={(email, verified) =>
               updateUser({ email, email_verified: verified })
            }
         />
         <ButtonGroup padding="loose">
            <Link to="/user">
               <Button name="Back" />
            </Link>
            <Link to="/" onClick={() => triggerLogoFadeOut()}>
               <Button name="Home" />
            </Link>
         </ButtonGroup>
      </>
   );
}

function IconPickerSection({
   currentIcon,
   token,
   onIconChange,
}: {
   currentIcon: string;
   token: string;
   onIconChange: (icon: string) => void;
}) {
   const [selected, setSelected] = useState(currentIcon);
   const [open, setOpen] = useState(false);
   const pickerRef = useRef<HTMLDivElement>(null);
   const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   const lastSaved = useRef(currentIcon);

   useEffect(() => {
      setSelected(currentIcon);
      lastSaved.current = currentIcon;
   }, [currentIcon]);

   const handleSelect = useCallback(
      (key: string) => {
         if (key === selected) return;
         setSelected(key);

         if (saveTimer.current) clearTimeout(saveTimer.current);
         saveTimer.current = setTimeout(async () => {
            if (key === lastSaved.current) return;
            try {
               const res = await fetch(`${getApiUrl()}/profile`, {
                  method: "PATCH",
                  headers: {
                     "Content-Type": "application/json",
                     Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ profile_icon: key }),
               });
               if (res.ok) {
                  lastSaved.current = key;
                  onIconChange(key);
               }
            } catch {
               /* network error -- selection stays optimistic */
            }
         }, 400);
      },
      [selected, token, onIconChange]
   );

   const iconsByCategory = PROFILE_ICON_CATEGORIES.map((cat) => ({
      category: cat,
      icons: PROFILE_ICONS.filter((i) => i.category === cat),
   }));

   return (
      <>
         <h2>Profile Icon</h2>
         <div className={styles.iconPreview}>
            <div
               className={`${styles.iconPreviewCircle} ${styles.iconPreviewClickable}`}
               role="button"
               tabIndex={0}
               aria-expanded={open}
               aria-label="Toggle icon picker"
               onClick={() => setOpen((v) => !v)}
               onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                     e.preventDefault();
                     setOpen((v) => !v);
                  }
               }}
            >
               <FontAwesomeIcon icon={getProfileIcon(selected)} />
            </div>
            <span className={styles.iconPreviewLabel}>
               {PROFILE_ICONS.find((i) => i.key === selected)?.label ??
                  "Default"}
            </span>
            <span className={styles.iconPreviewHint}>
               {open ? "tap to close" : "tap to change"}
            </span>
         </div>

         <div
            ref={pickerRef}
            className={`${styles.pickerContainer} ${
               open ? styles.pickerOpen : styles.pickerClosed
            }`}
            style={
               !open
                  ? { maxHeight: 0 }
                  : {
                       maxHeight: pickerRef.current
                          ? pickerRef.current.scrollHeight + 48
                          : 9999,
                    }
            }
         >
            <div className={styles.pickerInner}>
               {iconsByCategory.map(({ category, icons }) => (
                  <div key={category}>
                     <div className={styles.categoryLabel}>{category}</div>
                     <div className={styles.iconGrid}>
                        {icons.map((entry) => (
                           <div
                              key={entry.key}
                              role="button"
                              tabIndex={open ? 0 : -1}
                              aria-label={entry.label}
                              aria-pressed={selected === entry.key}
                              className={`${styles.iconCell} ${
                                 selected === entry.key
                                    ? styles.iconCellActive
                                    : ""
                              }`}
                              onClick={() => handleSelect(entry.key)}
                              onKeyDown={(e) => {
                                 if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleSelect(entry.key);
                                 }
                              }}
                              title={entry.label}
                           >
                              <FontAwesomeIcon icon={entry.icon} />
                           </div>
                        ))}
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </>
   );
}

function EmailSection({
   currentEmail,
   emailVerified,
   token,
   onEmailChange,
}: {
   currentEmail: string;
   emailVerified: boolean;
   token: string;
   onEmailChange: (email: string, verified: boolean) => void;
}) {
   const [email, setEmail] = useState(currentEmail);
   const [verified, setVerified] = useState(emailVerified);
   const [saving, setSaving] = useState(false);
   const [message, setMessage] = useState("");
   const [resending, setResending] = useState(false);

   useEffect(() => {
      setEmail(currentEmail);
      setVerified(emailVerified);
   }, [currentEmail, emailVerified]);

   const isDirty = email.trim().toLowerCase() !== currentEmail.toLowerCase();

   const handleSave = async () => {
      if (!isDirty || saving) return;
      setSaving(true);
      setMessage("");
      try {
         const res = await fetch(`${getApiUrl()}/profile`, {
            method: "PATCH",
            headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email: email.trim() }),
         });
         const data = await res.json().catch(() => ({}));
         if (res.ok) {
            const u = data.user;
            setVerified(u?.email_verified ?? false);
            onEmailChange(u?.email ?? email.trim(), u?.email_verified ?? false);
            setMessage("Verification email sent!");
         } else {
            setMessage(data.error ?? "Something went wrong");
         }
      } catch {
         setMessage("Unable to reach the server");
      } finally {
         setSaving(false);
      }
   };

   const handleResend = async () => {
      if (resending) return;
      setResending(true);
      setMessage("");
      try {
         await fetch(`${getApiUrl()}/resend-verification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: currentEmail }),
         });
         setMessage("Verification email sent!");
      } catch {
         setMessage("Unable to reach the server");
      } finally {
         setResending(false);
      }
   };

   return (
      <div className={styles.emailSection}>
         <h2>Email</h2>
         <div className={styles.emailRow}>
            <FormInput
               type="email"
               value={email}
               onChange={(e) => {
                  setEmail(e.target.value);
                  setMessage("");
               }}
               placeholder="Email address"
               autoComplete="email"
            />
            <button
               type="button"
               className={styles.emailSaveBtn}
               onClick={handleSave}
               disabled={!isDirty || saving}
            >
               {saving ? "Saving…" : "Save"}
            </button>
         </div>

         <div
            className={`${styles.verificationStatus} ${
               verified ? styles.verified : styles.notVerified
            }`}
         >
            <FontAwesomeIcon
               icon={verified ? faCircleCheck : faTriangleExclamation}
            />
            <span>{verified ? "Verified" : "Not verified"}</span>
            {!verified && (
               <StyledLink
                  href="#"
                  className={styles.resendLink}
                  onClick={(e) => {
                     e.preventDefault();
                     handleResend();
                  }}
               >
                  {resending ? "Sending…" : "Resend"}
               </StyledLink>
            )}
         </div>

         {message && <div className={styles.emailMessage}>{message}</div>}
      </div>
   );
}
