import React from "react";

export interface HeartIconProps {
   size?: number;
   color?: string;
   style?: React.CSSProperties;
}

export const HeartIcon: React.FC<HeartIconProps> = ({
   size = 40,
   color = "currentColor",
   style,
}) => (
   <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="-50 100 3080 2800"
      aria-hidden="true"
      style={style}
   >
      <path
         d="M 2866.488281 972.351562 C 2710.058594 167.71875 1729.558594 154.269531 1487.78125 906.46875 C 1246.011719 154.28125 265.480469 167.71875 109.074219 972.351562 C -32.855469 1702.371094 1487.78125 2854.109375 1487.78125 2854.109375 C 1487.78125 2854.109375 3008.410156 1702.371094 2866.488281 972.351562 Z"
         fill={color}
      />
   </svg>
);
