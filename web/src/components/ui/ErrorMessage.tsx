import React from "react";

export interface ErrorMessageProps {
  children: React.ReactNode;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  children,
  className = "",
}) => (
  <span className={`text-warningicon text-sm ${className}`.trim()}>
    {children}
  </span>
);
