import React from "react";

export interface SelectOption<T extends string | number = string | number> {
   value: T;
   label: string;
}

export interface SelectProps<T extends string | number = string | number> {
   /** Current value (must match one option value) */
   value: T;
   /** Called when the user picks an option */
   onChange: (value: T) => void;
   /** Options to show */
   options: SelectOption<T>[] | readonly SelectOption<T>[];
   disabled?: boolean;
   id?: string;
   "aria-label"?: string;
   className?: string;
}

const ChevronDown: React.FC<{ className?: string }> = ({ className }) => (
   <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className={className}
      aria-hidden
   >
      <path fill="currentColor" d="M6 8L1 3h10z" />
   </svg>
);

export function Select<T extends string | number = string | number>({
   value,
   onChange,
   options,
   disabled = false,
   id,
   "aria-label": ariaLabel,
   className,
}: SelectProps<T>): React.ReactElement {
   const stringValue = String(value);

   return (
      <div
         className={`relative inline-block min-w-[72px] ${
            className ?? ""
         }`.trim()}
      >
         <select
            id={id}
            className="w-full cursor-pointer appearance-none rounded-xl border border-[var(--inputboxborder)] bg-[var(--inputbox)] py-2.5 pl-3.5 pr-8 text-[15px] font-semibold tracking-wide text-[var(--header)] transition-[border-color,box-shadow] focus:border-[var(--radiobutton)] focus:outline-none focus:ring-2 focus:ring-[var(--radiobutton)]/25 disabled:cursor-not-allowed disabled:opacity-40"
            value={stringValue}
            onChange={(e) => {
               const option = options.find(
                  (o) => String(o.value) === e.target.value
               );
               if (option) onChange(option.value);
            }}
            disabled={disabled}
            aria-label={ariaLabel}
         >
            {options.map((opt) => (
               <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
               </option>
            ))}
         </select>
         <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--header)]">
            <ChevronDown />
         </span>
      </div>
   );
}
