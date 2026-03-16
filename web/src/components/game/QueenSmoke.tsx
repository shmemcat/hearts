import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloud } from "@fortawesome/pro-solid-svg-icons";
import styles from "./QueenSmoke.module.css";

const PARTICLE_COUNT = 3;
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => i);

export interface QueenSmokeProps {
   children: React.ReactNode;
}

/**
 * Wraps its children with a short puff-of-smoke particle burst.
 * Fires once on mount — intended to be keyed so it remounts per play.
 */
export const QueenSmoke: React.FC<QueenSmokeProps> = ({ children }) => (
   <div className={styles.wrap}>
      {children}
      <div className={styles.particles} aria-hidden="true">
         {particles.map((i) => (
            <span key={i} className={styles.p}>
               <FontAwesomeIcon icon={faCloud} />
            </span>
         ))}
      </div>
   </div>
);
