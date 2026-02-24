import React from "react";
import containers from "@/styles/containers.module.css";
import { Tooltip } from "@/components/Tooltip";

export interface CreateGameSelectionsProps {
   className?: string;
   /** Lifted state: when provided, component is controlled */
   gameType?: string;
   onGameTypeChange?: (value: string) => void;
   difficulty?: string;
   onDifficultyChange?: (value: string) => void;
   /** Show tooltip nudging user to Options for hard sub-difficulty */
   showHardTooltip?: boolean;
}

export const CreateGameSelections: React.FC<CreateGameSelectionsProps> = ({
   gameType: controlledGameType,
   onGameTypeChange,
   difficulty: controlledDifficulty,
   onDifficultyChange,
   showHardTooltip = false,
}) => {
   const [internalGameType, setInternalGameType] =
      React.useState("Versus Bots");
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
                  value="Versus Bots"
                  name="gameType"
                  className="radio mr-[5px]"
                  checked={gameType === "Versus Bots"}
                  onChange={onChangeValue}
               />{" "}
               Versus Bots
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
         {gameType === "Versus Bots" ? (
            <Difficulty
               difficulty={difficulty}
               onDifficultyChange={setDifficulty}
               showHardTooltip={showHardTooltip}
            />
         ) : gameType === "Online" ? (
            <div className="pt-4">
               <Tooltip
                  content="Remaining spots will be backfilled by bots"
                  side="bottom"
               >
                  <p className="text-sm opacity-70 cursor-default inline-block">
                     Invite friends via the lobby link or code.
                     <br />
                     Empty seats are filled by bots.
                  </p>
               </Tooltip>
            </div>
         ) : null}
      </>
   );
};

const Difficulty: React.FC<{
   difficulty: string;
   onDifficultyChange: (value: string) => void;
   showHardTooltip?: boolean;
}> = ({ difficulty, onDifficultyChange, showHardTooltip = false }) => {
   function onChangeValue(event: React.ChangeEvent<HTMLInputElement>) {
      const value = event.target.value;
      if (value) onDifficultyChange(value);
   }

   const myMomLabel = (
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
   );

   return (
      <>
         <div className="pt-6">
            <h2>Bot Difficulty</h2>
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
            {showHardTooltip ? (
               <Tooltip
                  content="Want more of a challenge? Bump up the difficulty in Options!"
                  side="bottom"
               >
                  <span>{myMomLabel}</span>
               </Tooltip>
            ) : (
               myMomLabel
            )}
         </div>
      </>
   );
};
