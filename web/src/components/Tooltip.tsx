import * as TooltipPrimitive from "@radix-ui/react-tooltip";

type TooltipProps = {
   content: React.ReactNode;
   children: React.ReactElement;
   open?: boolean;
   side?: "top" | "right" | "bottom" | "left";
   sideOffset?: number;
};

/** Inline styles so tooltip applies correctly when portaled to body (outside theme wrapper). */
const tooltipStyle: React.CSSProperties = {
   backgroundColor: "var(--tooltipbackground)",
   color: "var(--tooltiptext)",
   fontWeight: 700,
   fontSize: "0.875rem",
   letterSpacing: "1.5px",
   borderRadius: "6px",
   padding: "6px 12px",
   maxWidth: "280px",
   zIndex: 9999,
};

export function Tooltip({
   content,
   children,
   open,
   side = "top",
   sideOffset = 6,
}: TooltipProps) {
   return (
      <TooltipPrimitive.Provider delayDuration={0}>
         <TooltipPrimitive.Root open={open}>
            <TooltipPrimitive.Trigger asChild>
               {children}
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
               <TooltipPrimitive.Content
                  side={side}
                  sideOffset={sideOffset}
                  style={tooltipStyle}
               >
                  {content}
               </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
         </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
   );
}
