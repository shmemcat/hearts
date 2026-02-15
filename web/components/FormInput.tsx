"use client";

import { forwardRef } from "react";
import { Tooltip } from "@/components/Tooltip";

const inputStyle: React.CSSProperties = {
   padding: "8px 12px",
   width: "100%",
   boxSizing: "border-box",
};

type FormInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "style"> & {
   error?: string;
   inputStyle?: React.CSSProperties;
   width?: string | number;
   fontWeight?: string | number;
};

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
   ({ error, inputStyle: styleOverride, width, fontWeight, ...props }, ref) => {
      const style: React.CSSProperties = {
         ...inputStyle,
         ...(width !== undefined && {
            width: typeof width === "number" ? `${width}px` : width,
         }),
         ...(fontWeight !== undefined && { fontWeight }),
         ...styleOverride,
      };
      const input = (
         <input ref={ref} style={style} aria-invalid={!!error} {...props} />
      );

      if (error !== undefined) {
         return (
            <Tooltip content={error} open={!!error} side="bottom">
               {input}
            </Tooltip>
         );
      }

      return input;
   }
);

FormInput.displayName = "FormInput";
