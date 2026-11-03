import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/Buttons";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import { useSavedGames } from "@/hooks/useSavedGames";
import { InProgressGames } from "@/components/InProgressGames";
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
   const saved = useSavedGames();
   const navigate = useNavigate();

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
            <InProgressGames
               games={saved.games}
               error={saved.error}
               onRetry={saved.retry}
               onResume={(id) => {
                  const path = saved.resume(id);
                  if (path) navigate(path);
               }}
               onConcede={saved.concede}
            />
            <ButtonGroup padding="loose">
               <Link to="/" onClick={() => triggerLogoFadeOut()}>
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
