import { useId, useState } from "react";
import {
   setAnimationsOverride,
   useMotionPreference,
} from "../lib/motionPreference";
import "./AnimationOption.css";

export function AnimationOption() {
   const { systemReduced, overridden } = useMotionPreference();
   const title = useId();
   const description = useId();
   const group = useId();
   const [saved, setSaved] = useState(true);
   if (!systemReduced) return null;
   return (
      <section className="animation-option" aria-labelledby={title}>
         <h2 id={title}>Animations</h2>
         <p id={description} className="animation-option-hint">
            Your device has requested reduced motion. Choose whether to show
            animations in this game.
         </p>
         <div
            className="animation-option-choices"
            role="radiogroup"
            aria-labelledby={title}
            aria-describedby={description}
         >
            <label>
               <input
                  type="radio"
                  name={group}
                  value="system"
                  checked={!overridden}
                  onChange={() => setSaved(setAnimationsOverride(false))}
               />
               <span>Keep animations disabled (default)</span>
            </label>
            <label>
               <input
                  type="radio"
                  name={group}
                  value="override"
                  checked={overridden}
                  onChange={() => setSaved(setAnimationsOverride(true))}
               />
               <span>Show website animations</span>
            </label>
         </div>
         {!saved && (
            <p role="alert">
               Your browser couldn’t save this choice. It will apply for this
               visit.
            </p>
         )}
      </section>
   );
}
