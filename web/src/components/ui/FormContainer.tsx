import React from "react";

export interface FormContainerProps
   extends React.FormHTMLAttributes<HTMLFormElement> {
   children: React.ReactNode;
   topMargin?: boolean;
   className?: string;
}

export const FormContainer: React.FC<FormContainerProps> = ({
   children,
   className = "",
   topMargin = true,
   ...formProps
}) => (
   <form
      className={`flex flex-col gap-4 max-w-[280px] ${
         topMargin ? "mt-5" : ""
      } ${className}`.trim()}
      {...formProps}
   >
      {children}
   </form>
);
