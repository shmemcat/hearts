import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { Button } from "@/components/Buttons";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { useActiveGameModals } from "@/hooks/useActiveGameModals";
import styles from "@/styles/play-menu.module.css";

const CHOICES = [
   {
      to: "/game/create",
      label: "Create Game",
      desc: "Start a new game against bots or online",
   },
   {
      to: "/game/join",
      label: "Join Game",
      desc: "Enter a lobby code to join a friend",
   },
] as const;

export default function PlayPage() {
   const activeGameModals = useActiveGameModals();

   return (
      <>
         <Helmet>
            <title>Play | Hearts</title>
         </Helmet>
         <PageLayout title="PLAY">
            <div className={styles.grid}>
               {CHOICES.map(({ to, label, desc }) => (
                  <Link key={to} to={to} className={styles.choice}>
                     <span className={styles.choiceLabel}>{label}</span>
                     <span className={styles.choiceDesc}>{desc}</span>
                  </Link>
               ))}
            </div>
            <ButtonGroup padding="loose">
               <Link to="/" onClick={() => triggerLogoFadeOut()}>
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </PageLayout>
         {activeGameModals}
      </>
   );
}
