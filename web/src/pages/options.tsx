import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { Button } from "@/components/Buttons";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { Card } from "@/components/game/Card";
import { useCardStyle, type CardStyle } from "@/context/CardStyleContext";
import { useHardLevel, type HardLevel } from "@/context/HardLevelContext";
import {
   useMobileLayout,
   type MobileLayout,
} from "@/context/MobileLayoutContext";
import { PageLayout, ButtonGroup } from "@/components/ui";
import styles from "@/styles/options.module.css";

const PREVIEW_CODES = ["Ah", "Qs", "Jd", "Kc"];

const STYLES: { id: CardStyle; label: string }[] = [
   { id: "standard", label: "Standard" },
   { id: "flourish", label: "Flourish" },
];

const HARD_LEVELS: { id: HardLevel; label: string; description: string }[] = [
   { id: "hard", label: "Hard", description: "She's paying attention" },
   { id: "harder", label: "Harder", description: "She means business" },
   { id: "hardest", label: "Hardest", description: "No mercy" },
];

export default function OptionsPage() {
   return (
      <>
         <Helmet>
            <title>Options | Hearts</title>
         </Helmet>
         <PageLayout title="OPTIONS">
            <div className="flex flex-col gap-4">
               <CardStylePicker />
               <MobileLayoutPicker />
               <HardLevelPicker />
               <ButtonGroup padding="loose">
                  <Link to="/user">
                     <Button name="Back" />
                  </Link>
                  <Link to="/" onClick={() => triggerLogoFadeOut()}>
                     <Button name="Home" />
                  </Link>
               </ButtonGroup>
            </div>
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
      </>
   );
}

const LAYOUT_SUITS = [
   "b",
   "b",
   "b",
   "r",
   "r",
   "r",
   "r",
   "b",
   "b",
   "b",
   "b",
   "r",
   "r",
] as const;

function MiniCardRow({
   count,
   suitOffset,
   overlap,
   arc,
}: {
   count: number;
   suitOffset: number;
   overlap: number;
   arc: number;
}) {
   const center = (count - 1) / 2;
   return (
      <>
         {Array.from({ length: count }, (_, i) => {
            const dist = i - center;
            const rot = dist * arc;
            const yOff = Math.pow(Math.abs(dist), 2) * (arc * 0.2);
            const suit = LAYOUT_SUITS[(i + suitOffset) % LAYOUT_SUITS.length];
            return (
               <div
                  key={i}
                  className={`${styles.miniCard} ${
                     suit === "r" ? styles.miniCardRed : styles.miniCardBlack
                  }`}
                  style={{
                     transform: `translateY(${yOff}px) rotate(${rot}deg)`,
                     marginLeft: i === 0 ? 0 : overlap,
                  }}
               />
            );
         })}
      </>
   );
}

function SingleRowPreview() {
   return (
      <div className={styles.layoutPreview} style={{ paddingBottom: 22 }}>
         <div className={styles.layoutPreviewRow}>
            <MiniCardRow count={13} suitOffset={0} overlap={-6} arc={1.2} />
         </div>
      </div>
   );
}

function DoubleRowPreview() {
   return (
      <div className={styles.layoutPreview}>
         <div className={styles.layoutPreviewRow}>
            <MiniCardRow count={6} suitOffset={0} overlap={-4} arc={0.8} />
         </div>
         <div
            className={`${styles.layoutPreviewRow} ${styles.layoutPreviewFrontRow}`}
         >
            <MiniCardRow count={7} suitOffset={6} overlap={-4} arc={0.8} />
         </div>
      </div>
   );
}

const MOBILE_LAYOUTS: {
   id: MobileLayout;
   label: string;
   description: string;
   preview: React.ReactNode;
}[] = [
   {
      id: "single",
      label: "One Row",
      description: "All cards in a single row",
      preview: <SingleRowPreview />,
   },
   {
      id: "double",
      label: "Two Rows",
      description: "Two rows of cards, easier to tap",
      preview: <DoubleRowPreview />,
   },
];

function MobileLayoutPicker() {
   const { mobileLayout, setMobileLayout } = useMobileLayout();

   return (
      <div className={styles.hardLevelSection}>
         <h2>Mobile Card Layout</h2>
         <p className={styles.hardLevelDesc} style={{ marginBottom: 8 }}>
            How should cards above 7 behave on mobile?
         </p>
         <div className={styles.optionsGrid}>
            {MOBILE_LAYOUTS.map(({ id, label, description, preview }) => {
               const active = mobileLayout === id;
               return (
                  <div
                     key={id}
                     role="button"
                     tabIndex={0}
                     aria-pressed={active}
                     className={`${styles.styleChoice} ${
                        active ? styles.styleChoiceActive : ""
                     }`}
                     style={{ flex: "1 1 0" }}
                     onClick={() => setMobileLayout(id)}
                     onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                           e.preventDefault();
                           setMobileLayout(id);
                        }
                     }}
                  >
                     <span className={styles.styleLabel}>{label}</span>
                     {preview}
                     <span className={styles.hardLevelDesc}>{description}</span>
                     {active && (
                        <span className={styles.styleBadge}>Selected</span>
                     )}
                  </div>
               );
            })}
         </div>
      </div>
   );
}

function HardLevelPicker() {
   const { hardLevel, setHardLevel } = useHardLevel();

   return (
      <div className={styles.hardLevelSection}>
         <h2>How hard should my mom try to beat you?</h2>
         <div className={styles.hardLevelGrid}>
            {HARD_LEVELS.map(({ id, label, description }) => {
               const active = hardLevel === id;
               return (
                  <div
                     key={id}
                     role="button"
                     tabIndex={0}
                     aria-pressed={active}
                     className={`${styles.hardLevelChoice} ${
                        active ? styles.hardLevelChoiceActive : ""
                     }`}
                     onClick={() => setHardLevel(id)}
                     onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                           e.preventDefault();
                           setHardLevel(id);
                        }
                     }}
                  >
                     <span className={styles.hardLevelLabel}>{label}</span>
                     <span className={styles.hardLevelDesc}>{description}</span>
                     {active && (
                        <span className={styles.styleBadge}>Selected</span>
                     )}
                  </div>
               );
            })}
         </div>
      </div>
   );
}
