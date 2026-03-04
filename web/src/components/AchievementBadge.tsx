import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Sparkle } from "@/components/Sparkle";
import { Tooltip } from "@/components/Tooltip";
import type { ComputedAchievement, Tier } from "@/lib/achievements";
import styles from "@/styles/achievements.module.css";

type Props = {
   achievement: ComputedAchievement;
};

export function AchievementBadge({ achievement }: Props) {
   const { def, tier, unlocked, progress } = achievement;
   const isSecret = def.secret;

   const label = getLabel(achievement);
   const tooltipContent = getTooltipContent(achievement);

   return (
      <div className={styles.achievementItem}>
         <Tooltip content={tooltipContent} side="top">
            <div
               className={`${styles.badge} ${
                  unlocked ? styles.badge_unlocked : styles.badge_locked
               }`}
            >
               {unlocked && <div className={styles.badgeShine} />}
               {unlocked && (
                  <Sparkle className={styles.badgeSparkle} fill="white" />
               )}
               {unlocked ? (
                  <span
                     className={`${styles.badgeIcon} ${
                        tier ? styles[`badgeIcon_${tier}`] : ""
                     }`}
                  >
                     <FontAwesomeIcon icon={def.icon} />
                  </span>
               ) : isSecret ? (
                  <span className={styles.badgeSecretQuestion}>?</span>
               ) : null}
            </div>
         </Tooltip>
         <span
            className={`${styles.achievementLabel} ${
               unlocked ? "" : styles.achievementLabel_locked
            }`}
         >
            {label}
         </span>
      </div>
   );
}

function getLabel(a: ComputedAchievement): string {
   const { def, tier, unlocked } = a;

   if (def.secret) {
      return unlocked ? def.singleName ?? "???" : "????";
   }

   if (!def.tiers) return def.singleName ?? def.id;

   if (!tier) return def.tiers.bronze.name;
   return def.tiers[tier].name;
}

function getTooltipContent(a: ComputedAchievement) {
   const { def, tier, unlocked, progress } = a;

   if (def.secret && !unlocked) {
      return (
         <div className={styles.tooltipContent}>
            <span className={styles.tooltipName}>????</span>
            <span className={styles.tooltipDesc}>
               This is a secret achievement
            </span>
         </div>
      );
   }

   if (def.secret) {
      return (
         <div className={styles.tooltipContent}>
            <span className={styles.tooltipName}>{def.singleName}</span>
            <span className={styles.tooltipDesc}>{def.singleDescription}</span>
         </div>
      );
   }

   if (!def.tiers) return null;

   const tierLabel = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : null;
   const currentTierInfo = tier ? def.tiers[tier] : null;
   const nextTier = getNextTier(tier);
   const nextTierInfo = nextTier ? def.tiers[nextTier] : null;

   return (
      <div className={styles.tooltipContent}>
         {tierLabel && <span className={styles.tooltipTier}>{tierLabel}</span>}
         <span className={styles.tooltipName}>
            {currentTierInfo?.name ?? def.tiers.bronze.name}
         </span>
         <span className={styles.tooltipDesc}>
            {currentTierInfo?.description ?? def.tiers.bronze.description}
         </span>
         {progress && (
            <span className={styles.tooltipProgress}>{progress}</span>
         )}
         {nextTierInfo && (
            <span className={styles.tooltipProgress}>
               Next: {nextTierInfo.name} — {nextTierInfo.description}
            </span>
         )}
      </div>
   );
}

function getNextTier(tier: Tier | null): Tier | null {
   if (tier === null) return "bronze";
   if (tier === "bronze") return "silver";
   if (tier === "silver") return "gold";
   return null;
}
