import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import party from "party-js";

import { Button } from "@/components/Buttons";
import { triggerLogoFadeOut } from "@/components/Navbar";
import { ButtonGroup } from "@/components/ui";
import { PlayerIcon } from "./PlayerIcon";
import type { GamePlayer } from "@/types/game";
import styles from "@/styles/play.module.css";

export interface GameOverBlockProps {
   players?: GamePlayer[];
   winnerIndex?: number | null;
   mySeatIndex?: number;
   /** Custom title (e.g. "Game Terminated"). When provided, skips confetti and winner-based title. */
   title?: string;
   /** Subtitle shown below the title (e.g. "All players have left the game.") */
   subtitle?: string;
   children?: React.ReactNode;
}

export const GameOverBlock: React.FC<GameOverBlockProps> = ({
   players = [],
   winnerIndex = null,
   mySeatIndex = 0,
   title: customTitle,
   subtitle,
   children,
}) => {
   const isCustomMode = customTitle != null;
   const isTie = !isCustomMode && winnerIndex === -1;
   const winnerName =
      !isCustomMode &&
      winnerIndex != null &&
      winnerIndex >= 0 &&
      players[winnerIndex]
         ? players[winnerIndex]?.name
         : null;
   const myWon = !isCustomMode && winnerIndex === mySeatIndex;
   const confettiRef = useRef<HTMLParagraphElement>(null);

   useEffect(() => {
      if (!myWon) return;
      const timer = setTimeout(() => {
         if (confettiRef.current) {
            party.confetti(confettiRef.current, {
               count: party.variation.range(80, 140),
            });
         }
      }, 100);
      return () => clearTimeout(timer);
   }, [myWon]);

   const title = isCustomMode
      ? customTitle
      : isTie
      ? "It's a tie!"
      : myWon
      ? "You won!"
      : winnerName
      ? `${winnerName} won!`
      : "Game Over";

   return (
      <div className={styles.gameOverBackdrop}>
         <div className={styles.gameOverBlock}>
            <p ref={confettiRef} className={styles.gameOverTitle}>
               {title}
            </p>
            {subtitle && <p className="text-sm opacity-80">{subtitle}</p>}
            {players.length > 0 && (
               <table className={styles.scoreTable}>
                  <thead>
                     <tr>
                        <th>Player</th>
                        <th>Score</th>
                     </tr>
                  </thead>
                  <tbody>
                     {[...players]
                        .map((p, i) => ({ ...p, idx: i }))
                        .sort((a, b) => a.score - b.score)
                        .map((p) => {
                           const isMe = p.idx === mySeatIndex;
                           return (
                              <tr
                                 key={p.idx}
                                 className={isMe ? styles.scoreTableMe : ""}
                              >
                                 <td>
                                    <PlayerIcon
                                       name={p.name}
                                       icon={p.icon}
                                       size={13}
                                    />{" "}
                                    {p.name}
                                 </td>
                                 <td>{p.score}</td>
                              </tr>
                           );
                        })}
                  </tbody>
               </table>
            )}
            {children ?? (
               <ButtonGroup padding="tight">
                  <Link to="/game/create">
                     <Button name="Play Again" style={{ width: "250px" }} />
                  </Link>
                  <Link to="/" onClick={() => triggerLogoFadeOut()}>
                     <Button name="Home" style={{ width: "250px" }} />
                  </Link>
               </ButtonGroup>
            )}
         </div>
      </div>
   );
};
