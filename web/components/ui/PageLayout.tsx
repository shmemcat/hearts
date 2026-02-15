import React from "react";
import containers from "@/styles/containers.module.css";
import { Navbar } from "@/components/navbar";
import { HeartsLogo } from "@/components/heartslogo";

export type PageLayoutVariant = "default" | "menu";

export interface PageLayoutProps {
   title: string;
   children: React.ReactNode;
   variant?: PageLayoutVariant;
   /** Applied to the wrapper that contains the title block and children */
   contentClassName?: string;
   /** Applied to the children wrapper (body content area) */
   className?: string;
}

const bodyContentClasses =
   "mt-10 w-[85vw] flex flex-col items-center justify-center text-center";

/** Same logo + title structure as index: original CSS .title-container + inline styles for overlap */
const titleBlockInlineStyles = {
   logo: {
      marginTop: "-100px",
      display: "block" as const,
      marginLeft: "auto",
      marginRight: "auto",
      userSelect: "none" as const,
   },
   h1: { marginTop: "-180px" },
};

export const PageLayout: React.FC<PageLayoutProps> = ({
   title,
   children,
   variant = "default",
   contentClassName,
   className,
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
         className={`flex flex-col items-center justify-center mt-[140px] ${
            contentClassName ?? ""
         }`.trim()}
      >
         <div className={containers["title-container"]}>
            <HeartsLogo style={titleBlockInlineStyles.logo} />
            <h1 style={titleBlockInlineStyles.h1}>{title}</h1>
         </div>
         <div className={className ?? bodyContentClasses}>{children}</div>
      </div>
   </div>
);
