import React from "react";
import containers from "@/styles/containers.module.css";

export interface CreateGameSelectionsProps {
   className?: string;
}

export const CreateGameSelections: React.FC<CreateGameSelectionsProps> = () => {
   const [gameType, setGameType] = React.useState("Versus AI");

   function onChangeValue(event: React.ChangeEvent<HTMLDivElement>) {
      const target = event.target as HTMLInputElement;
      if (target?.value) setGameType(target.value);
   }

   return (
      <>
         <h2>Game Type</h2>
         <div
            className={containers["create-button-container"]}
            onChange={onChangeValue}
         >
            <label className="select-none">
               <input
                  type="radio"
                  value="Versus AI"
                  name="gameType"
                  className="radio mr-[5px]"
                  checked={gameType === "Versus AI"}
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
               />{" "}
               Online
            </label>
         </div>
         {gameType === "Versus AI" ? <Difficulty /> : null}
      </>
   );
};

const Difficulty: React.FC = () => {
   const [difficulty, setDifficulty] = React.useState("Easy");

   function onChangeValue(event: React.ChangeEvent<HTMLDivElement>) {
      const target = event.target as HTMLInputElement;
      if (target?.value) setDifficulty(target.value);
   }

   return (
      <>
         <div className="pt-4">
            <h2>AI Difficulty</h2>
         </div>
         <div
            className={containers["create-button-container"]}
            onChange={onChangeValue}
         >
            <label className="select-none">
               <input
                  type="radio"
                  value="Easy"
                  name="difficulty"
                  className="radio mr-[5px]"
                  checked={difficulty === "Easy"}
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
               />{" "}
               My Mom
            </label>
         </div>
      </>
   );
};
