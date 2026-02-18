import React from "react";
import containers from "@/styles/containers.module.css";
import { Navbar } from "@/components/Navbar";
import { HeartsLogo } from "@/components/HeartsLogo";

export type PageLayoutVariant = "default" | "menu";

export interface PageLayoutProps {
   title: string;
   children: React.ReactNode;
   variant?: PageLayoutVariant;
   /** Applied to the wrapper that contains the title block and children */
   contentClassName?: string;
   /** Applied to the children wrapper (body content area) */
   className?: string;
   /** When true, do not show the hearts logo or title */
   hideTitleBlock?: boolean;
}

const bodyContentClasses =
   "mt-10 w-full px-2 flex flex-col items-center justify-center text-center";

const titleBlockInlineStyles = {
   logo: {
      marginTop: "-95px",
      display: "block" as const,
      marginLeft: "auto",
      marginRight: "auto",
      userSelect: "none" as const,
   },
   h1: { marginTop: "-153px" },
};

export const PageLayout: React.FC<PageLayoutProps> = ({
   title,
   children,
   variant = "default",
   contentClassName,
   className,
   hideTitleBlock = false,
}) => (
   <div
      className={
         variant === "menu"
            ? "w-full max-w-[1030px] mx-auto p-9 pb-[120px] box-border mt-5 mb-5 bg-transparent"
            : containers["content-border-container"]
      }
   >
      <Navbar />
      <div
         className={`flex flex-col items-center justify-center ${
            hideTitleBlock ? "mt-2 sm:mt-6" : "mt-[100px] sm:mt-[140px]"
         } ${contentClassName ?? ""}`.trim()}
      >
         {!hideTitleBlock && (
            <div className={containers["title-container"]}>
               <HeartsLogo style={titleBlockInlineStyles.logo} size={212} />
               <h1 style={titleBlockInlineStyles.h1}>{title}</h1>
            </div>
         )}
         <div className={className ?? bodyContentClasses}>{children}</div>
      </div>
   </div>
);
