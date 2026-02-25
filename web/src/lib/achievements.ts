import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
   faCardsBlank,
   faTrophy,
   faMoon,
   faStar,
   faBullseye,
   faShieldHeart,
   faHeart,
   faOwl,
   faDice,
   faWandMagicSparkles,
   faFire,
   faVolumeXmark,
   faPersonRunning,
   faSunBright,
   faCalendarHeart,
   faFlagCheckered,
   faBomb,
   faBoltLightning,
   faStopwatch,
   faEclipse,
   faHeartCrack,
} from "@fortawesome/pro-solid-svg-icons";
import type { UserStatsResponse } from "@/lib/gameApi";

export type Tier = "bronze" | "silver" | "gold";

export type AchievementDef = {
   id: string;
   secret: boolean;
   icon: IconDefinition;
   tiers: {
      bronze: { name: string; description: string };
      silver: { name: string; description: string };
      gold: { name: string; description: string };
   } | null;
   singleName?: string;
   singleDescription?: string;
};

export type ComputedAchievement = {
   def: AchievementDef;
   tier: Tier | null;
   unlocked: boolean;
   progress?: string;
};

const TIERED_ACHIEVEMENTS: AchievementDef[] = [
   {
      id: "newcomer",
      secret: false,
      icon: faCardsBlank,
      tiers: {
         bronze: { name: "Newcomer", description: "Play 10 games" },
         silver: { name: "Regular", description: "Play 50 games" },
         gold: { name: "Devoted", description: "Play 200 games" },
      },
   },
   {
      id: "winner",
      secret: false,
      icon: faTrophy,
      tiers: {
         bronze: { name: "Winner", description: "Win 10 games" },
         silver: { name: "Champion", description: "Win 25 games" },
         gold: { name: "Legend", description: "Win 100 games" },
      },
   },
   {
      id: "moongazer",
      secret: false,
      icon: faMoon,
      tiers: {
         bronze: { name: "Moongazer", description: "Shoot the moon 5 times" },
         silver: {
            name: "Moonwalker",
            description: "Shoot the moon 10 times",
         },
         gold: {
            name: "Moon Queen",
            description: "Shoot the moon 25 times",
         },
      },
   },
   {
      id: "tidy",
      secret: false,
      icon: faStar,
      tiers: {
         bronze: {
            name: "Tidy",
            description: "Finish a game with 10 points or fewer",
         },
         silver: {
            name: "Clean",
            description: "Finish a game with 5 points or fewer",
         },
         gold: {
            name: "Spotless",
            description: "Finish a game with 0 points",
         },
      },
   },
   {
      id: "consistent",
      secret: false,
      icon: faBullseye,
      tiers: {
         bronze: {
            name: "Consistent",
            description: "50% win rate after 20 games",
         },
         silver: {
            name: "Sharp",
            description: "60% win rate after 30 games",
         },
         gold: {
            name: "Dominant",
            description: "75% win rate after 50 games",
         },
      },
   },
   {
      id: "challenger",
      secret: false,
      icon: faShieldHeart,
      tiers: {
         bronze: { name: "Challenger", description: "Win on Hard" },
         silver: { name: "Fierce", description: "Win on Harder" },
         gold: { name: "Ruthless", description: "Win on Hardest" },
      },
   },
];

const SECRET_ACHIEVEMENTS: AchievementDef[] = [
   {
      id: "hi_mom",
      secret: true,
      icon: faHeart,
      tiers: null,
      singleName: "Hi Mom",
      singleDescription: "You beat her. She's proud. Maybe.",
   },
   {
      id: "night_owl",
      secret: true,
      icon: faOwl,
      tiers: null,
      singleName: "Night Owl",
      singleDescription: "Start a game after midnight",
   },
   {
      id: "lucky_seven",
      secret: true,
      icon: faDice,
      tiers: null,
      singleName: "Lucky Seven",
      singleDescription: "Win with exactly 7 points",
   },
   {
      id: "double_moon",
      secret: true,
      icon: faWandMagicSparkles,
      tiers: null,
      singleName: "Double Feature",
      singleDescription: "Shoot the moon twice in one game",
   },
   {
      id: "hot_streak",
      secret: true,
      icon: faFire,
      tiers: null,
      singleName: "Hot Streak",
      singleDescription: "Win 5 games in a row",
   },
   {
      id: "geezer",
      secret: true,
      icon: faVolumeXmark,
      tiers: null,
      singleName: "Geezer",
      singleDescription: "Turn the music off",
   },
   {
      id: "wimp",
      secret: true,
      icon: faPersonRunning,
      tiers: null,
      singleName: "Wimp",
      singleDescription: "Concede at the hardest difficulty",
   },
   {
      id: "early_bird",
      secret: true,
      icon: faSunBright,
      tiers: null,
      singleName: "Early Bird",
      singleDescription: "Start a game before 7 AM",
   },
   {
      id: "lonely_heart",
      secret: true,
      icon: faCalendarHeart,
      tiers: null,
      singleName: "Lonely Heart",
      singleDescription: "Play a game on Valentine's Day",
   },
   {
      id: "photo_finish",
      secret: true,
      icon: faFlagCheckered,
      tiers: null,
      singleName: "Photo Finish",
      singleDescription: "Win by exactly 1 point",
   },
   {
      id: "demolition",
      secret: true,
      icon: faBomb,
      tiers: null,
      singleName: "Demolition",
      singleDescription: "Win while an opponent has 100+ points",
   },
   {
      id: "speed_demon",
      secret: true,
      icon: faBoltLightning,
      tiers: null,
      singleName: "Speed Demon",
      singleDescription: "Win a game in 4 rounds or fewer",
   },
   {
      id: "marathon",
      secret: true,
      icon: faStopwatch,
      tiers: null,
      singleName: "Marathon",
      singleDescription: "Finish a game that goes 10+ rounds",
   },
   {
      id: "eclipse",
      secret: true,
      icon: faEclipse,
      tiers: null,
      singleName: "Eclipse",
      singleDescription: "Shoot the moon 3 times in one game",
   },
   {
      id: "heartbreaker",
      secret: true,
      icon: faHeartCrack,
      tiers: null,
      singleName: "Heartbreaker",
      singleDescription: "Break hearts 5 times in one game",
   },
];

export const ALL_ACHIEVEMENTS: AchievementDef[] = [
   ...TIERED_ACHIEVEMENTS,
   ...SECRET_ACHIEVEMENTS,
];

export function getAchievementById(id: string): AchievementDef | undefined {
   return ALL_ACHIEVEMENTS.find((a) => a.id === id);
}

function winRate(gp: number, gw: number): number {
   return gp > 0 ? (gw / gp) * 100 : 0;
}

export function computeAchievements(
   stats: UserStatsResponse
): ComputedAchievement[] {
   const results: ComputedAchievement[] = [];

   // Newcomer
   {
      const def = TIERED_ACHIEVEMENTS[0];
      let tier: Tier | null = null;
      if (stats.games_played >= 200) tier = "gold";
      else if (stats.games_played >= 50) tier = "silver";
      else if (stats.games_played >= 10) tier = "bronze";
      const next =
         tier === "gold"
            ? null
            : tier === "silver"
            ? 200
            : tier === "bronze"
            ? 50
            : 10;
      results.push({
         def,
         tier,
         unlocked: tier !== null,
         progress: next
            ? `${stats.games_played}/${next} games`
            : `${stats.games_played} games`,
      });
   }

   // Winner
   {
      const def = TIERED_ACHIEVEMENTS[1];
      let tier: Tier | null = null;
      if (stats.games_won >= 100) tier = "gold";
      else if (stats.games_won >= 25) tier = "silver";
      else if (stats.games_won >= 10) tier = "bronze";
      const next =
         tier === "gold"
            ? null
            : tier === "silver"
            ? 100
            : tier === "bronze"
            ? 25
            : 10;
      results.push({
         def,
         tier,
         unlocked: tier !== null,
         progress: next
            ? `${stats.games_won}/${next} wins`
            : `${stats.games_won} wins`,
      });
   }

   // Moongazer
   {
      const def = TIERED_ACHIEVEMENTS[2];
      let tier: Tier | null = null;
      if (stats.moon_shots >= 25) tier = "gold";
      else if (stats.moon_shots >= 10) tier = "silver";
      else if (stats.moon_shots >= 5) tier = "bronze";
      const next =
         tier === "gold"
            ? null
            : tier === "silver"
            ? 25
            : tier === "bronze"
            ? 10
            : 5;
      results.push({
         def,
         tier,
         unlocked: tier !== null,
         progress: next
            ? `${stats.moon_shots}/${next} moons`
            : `${stats.moon_shots} moons`,
      });
   }

   // Tidy (lower is better)
   {
      const def = TIERED_ACHIEVEMENTS[3];
      let tier: Tier | null = null;
      const bs = stats.best_score;
      if (bs !== null && bs <= 0) tier = "gold";
      else if (bs !== null && bs <= 5) tier = "silver";
      else if (bs !== null && bs <= 10) tier = "bronze";
      results.push({
         def,
         tier,
         unlocked: tier !== null,
         progress: bs !== null ? `Best: ${bs} points` : "No games played yet",
      });
   }

   // Consistent
   {
      const def = TIERED_ACHIEVEMENTS[4];
      let tier: Tier | null = null;
      const wr = winRate(stats.games_played, stats.games_won);
      if (stats.games_played >= 50 && wr >= 75) tier = "gold";
      else if (stats.games_played >= 30 && wr >= 60) tier = "silver";
      else if (stats.games_played >= 20 && wr >= 50) tier = "bronze";
      results.push({
         def,
         tier,
         unlocked: tier !== null,
         progress:
            stats.games_played > 0
               ? `${Math.round(wr)}% win rate`
               : "No games played yet",
      });
   }

   // Challenger
   {
      const def = TIERED_ACHIEVEMENTS[5];
      let tier: Tier | null = null;
      if (stats.hardest_wins >= 1) tier = "gold";
      else if (stats.harder_wins >= 1) tier = "silver";
      else if (stats.hard_wins >= 1) tier = "bronze";
      results.push({
         def,
         tier,
         unlocked: tier !== null,
         progress: tier
            ? `${
                 tier === "gold"
                    ? "Hardest"
                    : tier === "silver"
                    ? "Harder"
                    : "Hard"
              } defeated`
            : "Win on Hard difficulty",
      });
   }

   // Secret achievements
   const secretById = Object.fromEntries(
      SECRET_ACHIEVEMENTS.map((d) => [d.id, d])
   );
   const secretChecks: {
      def: AchievementDef;
      unlocked: boolean;
   }[] = [
      { def: secretById.hi_mom, unlocked: stats.hardest_wins >= 1 },
      { def: secretById.night_owl, unlocked: stats.night_owl },
      { def: secretById.lucky_seven, unlocked: stats.lucky_seven },
      { def: secretById.double_moon, unlocked: stats.double_moon },
      { def: secretById.hot_streak, unlocked: stats.max_win_streak >= 5 },
      { def: secretById.geezer, unlocked: stats.geezer },
      { def: secretById.wimp, unlocked: stats.wimp },
      { def: secretById.early_bird, unlocked: stats.early_bird },
      { def: secretById.lonely_heart, unlocked: stats.lonely_heart },
      { def: secretById.photo_finish, unlocked: stats.photo_finish },
      { def: secretById.demolition, unlocked: stats.demolition },
      { def: secretById.speed_demon, unlocked: stats.speed_demon },
      { def: secretById.marathon, unlocked: stats.marathon },
      { def: secretById.eclipse, unlocked: stats.eclipse },
      { def: secretById.heartbreaker, unlocked: stats.heartbreaker },
   ];

   for (const { def, unlocked } of secretChecks) {
      results.push({
         def,
         tier: unlocked ? "gold" : null,
         unlocked,
      });
   }

   return results;
}

/**
 * Given an achievement unlock ID from the backend (e.g. "winner_gold", "hi_mom"),
 * return display info for the toast.
 */
export function resolveUnlockId(unlockId: string): {
   def: AchievementDef;
   tier: Tier | null;
   name: string;
} | null {
   for (const def of TIERED_ACHIEVEMENTS) {
      if (!def.tiers) continue;
      for (const t of ["bronze", "silver", "gold"] as Tier[]) {
         if (`${def.id}_${t}` === unlockId) {
            return { def, tier: t, name: def.tiers[t].name };
         }
      }
   }

   for (const def of SECRET_ACHIEVEMENTS) {
      if (def.id === unlockId) {
         return { def, tier: "gold", name: def.singleName ?? def.id };
      }
   }

   return null;
}
