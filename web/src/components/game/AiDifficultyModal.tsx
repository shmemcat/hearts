import React from "react";
import { Button } from "@/components/Buttons";
import styles from "@/styles/play.module.css";

interface AiDifficultyModalProps {
   aiCount: number;
   defaultDifficulty?: string;
   onConfirm: (difficulty: string) => void;
   onCancel: () => void;
}

export const AiDifficultyModal: React.FC<AiDifficultyModalProps> = ({
   aiCount,
   defaultDifficulty = "Easy",
   onConfirm,
   onCancel,
}) => {
   const [difficulty, setDifficulty] = React.useState(defaultDifficulty);

   function onChangeValue(event: React.ChangeEvent<HTMLInputElement>) {
      setDifficulty(event.target.value);
   }

   return (
      <div className={styles.concededBackdrop}>
         <div className={styles.concededModal}>
            <p className={styles.concededTitle}>Start Game</p>
            <p className="text-sm mt-1 mb-3 opacity-80">
               {aiCount} {aiCount === 1 ? "seat" : "seats"} will be filled with
               AI
            </p>
            <div className="flex flex-col gap-2 mb-4">
               {["Easy", "Medium", "Hard"].map((level) => (
                  <label key={level} className="select-none">
                     <input
                        type="radio"
                        value={level}
                        name="ai-difficulty"
                        className="radio mr-[5px]"
                        checked={difficulty === level}
                        onChange={onChangeValue}
                     />{" "}
                     {level}
                  </label>
               ))}
            </div>
            <div className="flex gap-3">
               <Button
                  name="Start!"
                  onClick={() => onConfirm(difficulty.toLowerCase())}
                  style={{ width: "120px" }}
               />
               <Button
                  name="Cancel"
                  onClick={onCancel}
                  style={{ width: "120px" }}
               />
            </div>
         </div>
      </div>
   );
};
