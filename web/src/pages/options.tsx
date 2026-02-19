import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { Button } from "@/components/Buttons";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { Card } from "@/components/game/Card";
import { useCardStyle, type CardStyle } from "@/context/CardStyleContext";
import { PageLayout, ButtonGroup } from "@/components/ui";
import styles from "@/styles/options.module.css";

const PREVIEW_CODES = ["Ah", "Qs", "Jd", "Kc"];

const STYLES: { id: CardStyle; label: string }[] = [
   { id: "standard", label: "Standard" },
   { id: "flourish", label: "Flourish" },
];

export default function OptionsPage() {
   return (
      <>
         <Helmet>
            <title>Options | Hearts</title>
         </Helmet>
         <PageLayout title="OPTIONS">
            <CardStylePicker />
         </PageLayout>
      </>
   );
}

function CardStylePicker() {
   const { cardStyle, setCardStyle } = useCardStyle();

   const centerIndex = (PREVIEW_CODES.length - 1) / 2;
   const degPerCard = 6;
   const arcFactor = 4;

   return (
      <>
         <h2>Card Style</h2>
         <div className={styles.optionsGrid}>
            {STYLES.map(({ id, label }) => {
               const active = cardStyle === id;
               return (
                  <div
                     key={id}
                     role="button"
                     tabIndex={0}
                     aria-pressed={active}
                     className={`${styles.styleChoice} ${
                        active ? styles.styleChoiceActive : ""
                     }`}
                     onClick={() => setCardStyle(id)}
                     onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                           e.preventDefault();
                           setCardStyle(id);
                        }
                     }}
                  >
                     <span className={styles.styleLabel}>{label}</span>
                     <div className={styles.previewFan}>
                        {PREVIEW_CODES.map((code, i) => {
                           const distance = i - centerIndex;
                           const rotation = distance * degPerCard;
                           const translateY =
                              Math.pow(Math.abs(distance), 2) * arcFactor;
                           return (
                              <div
                                 key={code}
                                 className={styles.previewCardWrap}
                                 style={{
                                    transform: `translateY(${translateY}px) rotate(${rotation}deg)`,
                                    marginLeft: i === 0 ? 0 : -18,
                                 }}
                              >
                                 <Card
                                    code={code}
                                    size="normal"
                                    styleOverride={id}
                                 />
                              </div>
                           );
                        })}
                     </div>
                     {active && (
                        <span className={styles.styleBadge}>Selected</span>
                     )}
                  </div>
               );
            })}
         </div>

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
