import React from "react";

export type ButtonGroupPadding = "tight" | "default" | "loose";

export interface ButtonGroupProps {
   children: React.ReactNode;
   className?: string;
   padding?: ButtonGroupPadding;
}

const paddingClasses: Record<ButtonGroupPadding, string> = {
   tight: "pt-4",
   default: "pt-6",
   loose: "pt-10",
};

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
   children,
   className = "",
   padding = "default",
}) => (
   <div
      className={`flex flex-col gap-4 ${paddingClasses[padding]} ${className}`.trim()}
   >
      {children}
   </div>
);
