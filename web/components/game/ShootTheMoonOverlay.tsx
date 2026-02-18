"use client";

import React, { useEffect, useRef } from "react";
import party from "party-js";

import { Button } from "@/components/Buttons";
import styles from "./ShootTheMoonOverlay.module.css";

export interface ShootTheMoonData {
   shooterIndex: number;
   deltas: number[];
   round: number;
   players: { name: string; score: number }[];
}

export interface ShootTheMoonOverlayProps extends ShootTheMoonData {
   onContinue: () => void;
}

export const ShootTheMoonOverlay: React.FC<ShootTheMoonOverlayProps> = ({
   shooterIndex,
   players,
   deltas,
   onContinue,
}) => {
   const confettiRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const timer = setTimeout(() => {
         if (confettiRef.current) {
            party.confetti(confettiRef.current, {
               count: party.variation.range(60, 120),
            });
         }
      }, 1500);
      return () => clearTimeout(timer);
   }, []);

   return (
      <div className={styles.overlay}>
         <span className={styles.moon} aria-hidden>
            <span className={styles.moonLight}>🌕</span>
            <span className={styles.moonDark}>🌙</span>
         </span>
         <div className={styles.rocketWrap} aria-hidden>
            <span className={styles.rocket}>🚀</span>
         </div>
         <div className={styles.explosion} aria-hidden />
         <div ref={confettiRef} className={styles.confettiAnchor} />

         <p className={styles.title}>Shot the Moon!</p>
         <p className={styles.shooterName}>
            {players[shooterIndex]?.name} took all the hearts!
         </p>

         <div className={styles.deltas}>
            {players.map((p, i) => (
               <div key={i} className={styles.deltaItem}>
                  <span className={styles.deltaName}>{p.name}</span>
                  <span
                     className={`${styles.deltaBadge} ${
                        i === shooterIndex
                           ? styles.deltaShooter
                           : styles.deltaPenalty
                     }`}
                  >
                     {i === shooterIndex ? "0" : `+${deltas[i]}`}
                  </span>
               </div>
            ))}
         </div>

         <div className={styles.continueWrap}>
            <Button
               name="Continue"
               onClick={onContinue}
               style={{ width: "180px" }}
            />
         </div>
      </div>
   );
};
