import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { Button } from "@/components/Buttons";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { PageLayout, ButtonGroup } from "@/components/ui";
import {
   fetchLeaderboard,
   type LeaderboardEntry,
   type LeaderboardResponse,
} from "@/lib/gameApi";
import { getProfileIcon } from "@/lib/profileIcons";
import containers from "@/styles/containers.module.css";
import styles from "@/styles/leaderboard.module.css";

const TOP_TABS = [
   { key: "easy", label: "Easy", mobileLabel: null },
   { key: "medium", label: "Medium", mobileLabel: null },
   { key: "my_mom", label: "My Mom", mobileLabel: null },
   {
      key: "multiplayer",
      label: "Multiplayer",
      mobileLabel: (
         <>
            Multi-
            <br />
            player
         </>
      ),
   },
] as const;

const MOM_SUB_TABS = [
   { key: "hard", label: "Hard" },
   { key: "harder", label: "Harder" },
   { key: "hardest", label: "Hardest" },
] as const;

type TopTab = (typeof TOP_TABS)[number]["key"];
type ApiCategory =
   | "easy"
   | "medium"
   | "hard"
   | "harder"
   | "hardest"
   | "multiplayer";

function EntryRow({ entry }: { entry: LeaderboardEntry }) {
   return (
      <div className={styles.entry}>
         <span className={styles.rank}>{entry.rank}</span>
         <span className={styles.icon}>
            <FontAwesomeIcon icon={getProfileIcon(entry.profile_icon)} />
         </span>
         <span className={styles.username}>{entry.username}</span>
         <span className={styles.wins}>
            {entry.games_won} {entry.games_won === 1 ? "win" : "wins"}
         </span>
      </div>
   );
}

function LeaderboardColumn({
   title,
   entries,
}: {
   title: string;
   entries: LeaderboardEntry[];
}) {
   return (
      <div className={styles.column}>
         <div className={styles.columnTitle}>{title}</div>
         {entries.length === 0 ? (
            <div className={styles.empty}>No winners yet</div>
         ) : (
            <div className={styles.list}>
               {entries.map((e) => (
                  <EntryRow key={e.rank} entry={e} />
               ))}
            </div>
         )}
      </div>
   );
}

export default function LeaderboardPage() {
   const [topTab, setTopTab] = useState<TopTab>("easy");
   const [momSub, setMomSub] = useState<"hard" | "harder" | "hardest">("hard");
   const [data, setData] = useState<LeaderboardResponse | null>(null);
   const [loading, setLoading] = useState(false);

   const apiCategory: ApiCategory = topTab === "my_mom" ? momSub : topTab;

   useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setData(null);
      fetchLeaderboard(apiCategory).then((res) => {
         if (cancelled) return;
         if (res.ok) setData(res.data);
         setLoading(false);
      });
      return () => {
         cancelled = true;
      };
   }, [apiCategory]);

   return (
      <>
         <Helmet>
            <title>Leaderboard | Hearts</title>
         </Helmet>
         <PageLayout title="LEADERBOARD">
            <div className={containers["stats-tabs"]}>
               {TOP_TABS.map(({ key, label, mobileLabel }) => (
                  <button
                     key={key}
                     className={`${containers["stats-tab"]}${
                        topTab === key
                           ? ` ${containers["stats-tab-active"]}`
                           : ""
                     }`}
                     onClick={() => setTopTab(key)}
                  >
                     {mobileLabel ? (
                        <>
                           <span className={containers["desktop-only"]}>
                              {label}
                           </span>
                           <span className={containers["mobile-only"]}>
                              {mobileLabel}
                           </span>
                        </>
                     ) : (
                        label
                     )}
                  </button>
               ))}
            </div>

            {topTab === "my_mom" && (
               <div className={containers["stats-tabs"]}>
                  {MOM_SUB_TABS.map(({ key, label }) => (
                     <button
                        key={key}
                        className={`${containers["stats-tab"]}${
                           momSub === key
                              ? ` ${containers["stats-tab-active"]}`
                              : ""
                        }`}
                        onClick={() => setMomSub(key)}
                     >
                        {label}
                     </button>
                  ))}
               </div>
            )}

            {loading && !data ? (
               <div className={styles.empty}>Loading...</div>
            ) : (
               <div className={styles.columns}>
                  <LeaderboardColumn
                     title="Monthly"
                     entries={data?.monthly ?? []}
                  />
                  <LeaderboardColumn
                     title="All-Time"
                     entries={data?.all_time ?? []}
                  />
               </div>
            )}

            <ButtonGroup padding="loose">
               <Link to="/" onClick={() => triggerLogoFadeOut()}>
                  <Button name="Home" />
               </Link>
            </ButtonGroup>
         </PageLayout>
      </>
   );
}
