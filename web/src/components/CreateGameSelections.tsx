import React from "react";
import containers from "@/styles/containers.module.css";
import { Select, Toggle, type SelectOption } from "@/components/ui";
import { Tooltip } from "@/components/Tooltip";

export type NumAiPlayers = 1 | 2 | 3;

export interface CreateGameSelectionsProps {
   className?: string;
   /** Lifted state: when provided, component is controlled */
   gameType?: string;
   onGameTypeChange?: (value: string) => void;
   difficulty?: string;
   onDifficultyChange?: (value: string) => void;
   /** Online mode: include AI players (show toggle + dropdown) */
   aiPlayersEnabled?: boolean;
   onAiPlayersEnabledChange?: (value: boolean) => void;
   numAiPlayers?: NumAiPlayers;
   onNumAiPlayersChange?: (value: NumAiPlayers) => void;
   /** Show tooltip nudging user to Options for hard sub-difficulty */
   showHardTooltip?: boolean;
}

export const CreateGameSelections: React.FC<CreateGameSelectionsProps> = ({
   gameType: controlledGameType,
   onGameTypeChange,
   difficulty: controlledDifficulty,
   onDifficultyChange,
   aiPlayersEnabled: controlledAiEnabled,
   onAiPlayersEnabledChange,
   numAiPlayers: controlledNumAi,
   onNumAiPlayersChange,
   showHardTooltip = false,
}) => {
   const [internalGameType, setInternalGameType] = React.useState("Versus AI");
   const [internalDifficulty, setInternalDifficulty] = React.useState("Easy");
   const [internalAiEnabled, setInternalAiEnabled] = React.useState(false);
   const [internalNumAi, setInternalNumAi] = React.useState<NumAiPlayers>(1);

   const gameType = controlledGameType ?? internalGameType;
   const setGameType = onGameTypeChange ?? setInternalGameType;
   const difficulty = controlledDifficulty ?? internalDifficulty;
   const setDifficulty = onDifficultyChange ?? setInternalDifficulty;
   const aiPlayersEnabled = controlledAiEnabled ?? internalAiEnabled;
   const setAiPlayersEnabled = onAiPlayersEnabledChange ?? setInternalAiEnabled;
   const numAiPlayers = controlledNumAi ?? internalNumAi;
   const setNumAiPlayers = onNumAiPlayersChange ?? setInternalNumAi;

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
               showHardTooltip={showHardTooltip}
            />
         ) : gameType === "Online" ? (
            <OnlineAiOptions
               aiPlayersEnabled={aiPlayersEnabled}
               onAiPlayersEnabledChange={setAiPlayersEnabled}
               numAiPlayers={numAiPlayers}
               onNumAiPlayersChange={setNumAiPlayers}
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

const OnlineAiOptions: React.FC<{
   aiPlayersEnabled: boolean;
   onAiPlayersEnabledChange: (value: boolean) => void;
   numAiPlayers: NumAiPlayers;
   onNumAiPlayersChange: (value: NumAiPlayers) => void;
   difficulty: string;
   onDifficultyChange: (value: string) => void;
}> = ({
   aiPlayersEnabled,
   onAiPlayersEnabledChange,
   numAiPlayers,
   onNumAiPlayersChange,
   difficulty,
   onDifficultyChange,
}) => {
   const numOptions: SelectOption<NumAiPlayers>[] = [
      { value: 1, label: "1" },
      { value: 2, label: "2" },
      { value: 3, label: "3" },
   ];

   return (
      <>
         <div className={containers["create-online-ai-section"]}>
            <h2>AI Players</h2>
            <div className={containers["create-online-ai-inner"]}>
               <div className={containers["create-toggle-row"]}>
                  <span className={containers["create-toggle-label"]}>
                     <span className={containers["create-toggle-label-long"]}>
                        Include AI players
                     </span>
                     <span className={containers["create-toggle-label-short"]}>
                        Include
                     </span>
                  </span>
                  <Toggle
                     checked={aiPlayersEnabled}
                     onCheckedChange={onAiPlayersEnabledChange}
                     aria-label="Include AI players"
                  />
               </div>
               <div className={containers["create-select-row"]}>
                  <label
                     htmlFor="num-ai-players"
                     className={containers["create-select-label"]}
                  >
                     Number
                  </label>
                  <Select<NumAiPlayers>
                     id="num-ai-players"
                     value={numAiPlayers}
                     onChange={onNumAiPlayersChange}
                     options={numOptions}
                     disabled={!aiPlayersEnabled}
                     aria-label="Number of AI players"
                  />
               </div>
            </div>
         </div>
         {aiPlayersEnabled && (
            <Difficulty
               difficulty={difficulty}
               onDifficultyChange={onDifficultyChange}
            />
         )}
      </>
   );
};
