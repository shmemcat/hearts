import React from "react";
import containers from "@/styles/containers.module.css";

export interface CreateGameSelectionsProps {
   className?: string;
   /** Lifted state: when provided, component is controlled */
   gameType?: string;
   onGameTypeChange?: (value: string) => void;
   difficulty?: string;
   onDifficultyChange?: (value: string) => void;
}

export const CreateGameSelections: React.FC<CreateGameSelectionsProps> = ({
   gameType: controlledGameType,
   onGameTypeChange,
   difficulty: controlledDifficulty,
   onDifficultyChange,
}) => {
   const [internalGameType, setInternalGameType] = React.useState("Versus AI");
   const [internalDifficulty, setInternalDifficulty] = React.useState("Easy");
   const gameType = controlledGameType ?? internalGameType;
   const setGameType = onGameTypeChange ?? setInternalGameType;
   const difficulty = controlledDifficulty ?? internalDifficulty;
   const setDifficulty = onDifficultyChange ?? setInternalDifficulty;

   function onChangeValue(event: React.ChangeEvent<HTMLInputElement>) {
      const value = event.target.value;
      if (value) setGameType(value);
   }

   return (
      <>
         <h2>Game Type</h2>
         <div className={containers["create-button-container"]}>
            <label className="select-none">
               <input
                  type="radio"
                  value="Versus AI"
                  name="gameType"
                  className="radio mr-[5px]"
                  checked={gameType === "Versus AI"}
                  onChange={onChangeValue}
               />{" "}
               Versus AI
            </label>
            <label className="select-none">
               <input
                  type="radio"
                  value="Online"
                  name="gameType"
                  className="radio mr-[5px]"
                  checked={gameType === "Online"}
                  onChange={onChangeValue}
               />{" "}
               Online
            </label>
         </div>
         {gameType === "Versus AI" ? (
            <Difficulty
               difficulty={difficulty}
               onDifficultyChange={setDifficulty}
            />
         ) : null}
      </>
   );
};

const Difficulty: React.FC<{
   difficulty: string;
   onDifficultyChange: (value: string) => void;
}> = ({ difficulty, onDifficultyChange }) => {
   function onChangeValue(event: React.ChangeEvent<HTMLInputElement>) {
      const value = event.target.value;
      if (value) onDifficultyChange(value);
   }

   return (
      <>
         <div className="pt-4">
            <h2>AI Difficulty</h2>
         </div>
         <div className={containers["create-button-container"]}>
            <label className="select-none">
               <input
                  type="radio"
                  value="Easy"
                  name="difficulty"
                  className="radio mr-[5px]"
                  checked={difficulty === "Easy"}
                  onChange={onChangeValue}
               />{" "}
               Easy
            </label>
            <label className="select-none">
               <input
                  type="radio"
                  value="Medium"
                  name="difficulty"
                  className="radio mr-[5px]"
                  checked={difficulty === "Medium"}
                  onChange={onChangeValue}
               />{" "}
               Medium
            </label>
            <label className="select-none">
               <input
                  type="radio"
                  value="My Mom"
                  name="difficulty"
                  className="radio mr-[5px]"
                  checked={difficulty === "My Mom"}
                  onChange={onChangeValue}
               />{" "}
               My Mom
            </label>
         </div>
      </>
   );
};
