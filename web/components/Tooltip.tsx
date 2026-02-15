"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

const tooltipContentStyles: React.CSSProperties = {
  fontFamily: "appFont, sans-serif",
  fontSize: "14px",
  letterSpacing: "1.5px",
  color: "var(--text)",
  backgroundColor: "var(--contentbox)",
  border: "1px solid var(--inputboxborder)",
  borderRadius: "6px",
  padding: "8px 12px",
  boxShadow: "0 2px 8px var(--buttonboxshadow)",
  maxWidth: "280px",
  zIndex: 9999,
};

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  open?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
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
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={sideOffset}
            style={tooltipContentStyles}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
