import React from "react";
import containers from "@/styles/containers.module.css";

export const CreateGameSelections = (props) => {
   const [gameType, setGameType] = React.useState("Versus AI");

   function onChangeValue(event) {
      setGameType(event.target.value);
   }

   return (
      <>
         <h2>Game Type</h2>
         <div
            className={containers["create-button-container"]}
            onChange={onChangeValue}
         >
            <label style={{ userSelect: "none" }}>
               <input
                  type="radio"
                  value="Versus AI"
                  name="gameType"
                  className="radio"
                  style={{ marginRight: "5px" }}
                  checked={gameType === "Versus AI"}
               />{" "}
               Versus AI
            </label>
            <label style={{ userSelect: "none" }}>
               <input
                  type="radio"
                  value="Online"
                  name="gameType"
                  className="radio"
                  style={{ marginRight: "5px" }}
                  checked={gameType === "Online"}
               />{" "}
               Online
            </label>
         </div>
         {gameType === "Versus AI" ? <Difficulty /> : null}
      </>
   );
};

const Difficulty = () => {
   const [difficulty, setDifficulty] = React.useState("Easy");

   function onChangeValue(event) {
      setDifficulty(event.target.value);
   }

   return (
      <>
         <div style={{ paddingTop: "15px" }}>
            <h2>AI Difficulty</h2>
         </div>
         <div
            className={containers["create-button-container"]}
            onChange={onChangeValue}
         >
            <label style={{ userSelect: "none" }}>
               <input
                  type="radio"
                  value="Easy"
                  name="difficulty"
                  className="radio"
                  style={{ marginRight: "5px" }}
                  checked={difficulty === "Easy"}
               />{" "}
               Easy
            </label>
            <label style={{ userSelect: "none" }}>
               <input
                  type="radio"
                  value="Medium"
                  name="difficulty"
                  className="radio"
                  style={{ marginRight: "5px" }}
                  checked={difficulty === "Medium"}
               />{" "}
               Medium
            </label>
            <label style={{ userSelect: "none" }}>
               <input
                  type="radio"
                  value="My Mom"
                  name="difficulty"
                  className="radio"
                  style={{ marginRight: "5px" }}
                  checked={difficulty === "My Mom"}
               />{" "}
               My Mom
            </label>
         </div>
      </>
   );
};
