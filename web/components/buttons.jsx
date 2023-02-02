import button from "@/styles/buttons.module.css";
import React from "react";
import colors from "@/styles/design_tokens.js";

export const Button = (props) => {
   return (
      <button
         className={button["menu-button"]}
         disabled={props.disabled}
         onClick={props.onClick}
         role="button"
         style={props.style}
         aria-label={props.name}
      >
         <ButtonShine small={props.small} big={props.big} />
         {props.name}
      </button>
   );
};

const ButtonShine = (props) => {
   let small = props.small;
   let big = props.big;

   if (small) {
      return (
         <div
            className={button["button-shine"]}
            style={({ marginTop: "-4px" }, props.style)}
         ></div>
      );
   } else if (big) {
      return (
         <div
            className={button["button-shine"]}
            style={({ marginTop: "-4px" }, props.style)}
         ></div>
      );
   } else {
      return <div className={button["button-shine"]} style={props.style}></div>;
   }
};

export const RulesButton = (props) => {
   const [isHovered, setIsHovered] = React.useState(false);
   return (
      <button
         data-selected={props.selected}
         onMouseEnter={() => setIsHovered(true)}
         onMouseLeave={() => setIsHovered(false)}
         onClick={props.onClick}
         style={{ userSelect: "none" }}
         role="button"
         aria-label={props.name}
         className={
            props.selected
               ? button["rules-button-selected"]
               : button["rules-button"]
         }
         disabled={props.disabled}
      >
         {(isHovered || props.selected) && (
            <PipingBag
               isHovered={isHovered && !props.selected}
               width="27"
               height="16"
               left
            />
         )}
         {props.name}
         {(isHovered || props.selected) && (
            <PipingBag
               isHovered={isHovered && !props.selected}
               width="27"
               height="16"
               right
            />
         )}
      </button>
   );
};

const PipingBag = (props) => {
   const fillColor = props.isHovered ? colors.tan : colors.rulesbuttonselected;
   const width = props.width;
   const height = props.height;
   let className = button["piping-bag"];

   if (props.left) {
      className = button["piping-bag"];
   } else if (props.right) {
      className = button["piping-bag-right"];
   }

   return (
      <span className={className} style={props.style}>
         <svg
            width={width}
            height={height}
            viewBox="0 0 578 322"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
         >
            <path
               fillRule="evenodd"
               clipRule="evenodd"
               d="M15.2802 221.27C21.1402 229.2 28.0002 236.1 39.6502 233.53C44.8802 248.5 53.3802 261.3 63.1502 273.39C71.7802 284.09 85.5702 290.24 99.7802 279.17C108.354 272.491 117.086 266.011 125.818 259.532L125.819 259.531L125.819 259.531L125.821 259.53C129.899 256.503 133.978 253.477 138.04 250.43C144.996 245.248 151.889 240.051 158.85 234.803L158.854 234.8C161.9 232.504 164.958 230.199 168.04 227.88C170.568 231.766 173.08 235.618 175.578 239.447L175.579 239.449L175.58 239.451L175.584 239.456C181.632 248.728 187.596 257.872 193.49 267.07C194.293 268.328 195.093 269.588 195.892 270.848C203.881 283.44 211.857 296.011 223.32 306.12C241.37 322.05 265.74 325.7 287.37 315.35C302.093 308.305 316.876 301.422 331.657 294.541C338.591 291.313 345.524 288.084 352.45 284.84C394.204 265.32 435.924 245.737 477.61 226.09C478.396 225.719 479.183 225.348 479.969 224.977L482.555 223.756L482.556 223.756L482.556 223.755C501.361 214.876 520.153 206.003 539.46 198.17C541.193 197.465 542.936 196.775 544.68 196.084L544.682 196.084L544.683 196.083C552.679 192.919 560.7 189.745 567.94 185C576.56 179.34 579.61 171.06 576.86 161.2C576.022 157.973 574.458 154.98 572.289 152.448C570.119 149.916 567.401 147.913 564.34 146.59C555.922 142.667 547.474 138.808 539.027 134.95C515.094 124.019 491.163 113.09 467.91 100.68C451.486 91.8974 434.804 83.6209 418.121 75.3435C405.417 69.0407 392.713 62.7375 380.12 56.21C356.834 44.141 333.391 32.369 309.95 20.5976C300.353 15.7784 290.756 10.9594 281.17 6.12003C268.32 -0.369974 254.9 -0.999974 241.45 3.45003C225 8.84003 212.68 20 202.79 33.69C196.196 42.8003 189.95 52.1716 183.714 61.5271L183.714 61.5278L183.713 61.5286L183.713 61.5294C179.812 67.3818 175.915 73.2279 171.94 79C171.139 80.1797 170.389 81.3961 169.635 82.6164C167.585 85.9375 165.517 89.2869 162.38 92C157.2 89.8072 152.042 87.5942 146.891 85.3841L146.89 85.3834L146.884 85.3812L146.884 85.3811C135.829 80.6378 124.805 75.908 113.66 71.42C109.928 69.9129 106.272 68.2158 102.616 66.5189C95.113 63.0367 87.6126 59.5556 79.4702 57.72C70.1802 55.63 62.1802 58.16 56.1802 65.45C50.075 72.7453 45.2439 81.0179 41.8902 89.92C40.6114 93.3723 39.4155 96.8538 38.2413 100.273L38.2412 100.273L38.2411 100.273C37.7351 101.746 37.2331 103.208 36.7302 104.65C24.2402 105.8 20.6102 107.13 15.4702 113.26C11.6566 117.676 8.69639 122.763 6.74024 128.26C1.26024 144.26 0.800243 160.81 0.930243 177.49C0.862364 193.25 5.89651 208.608 15.2802 221.27ZM481.63 192.39C474.48 174.25 474.18 156.12 479 137.63L462.62 128.85C441.18 117.403 419.604 106.227 397.89 95.32C376.466 84.5485 355.091 73.6858 333.717 62.8236C313.836 52.7206 293.957 42.6182 274.04 32.59C267.67 29.38 260.9 27.17 253.41 28.66C240.06 31.31 230.93 39.94 223.06 50C213.859 61.7795 205.643 74.2142 197.431 86.6428L197.431 86.643L197.431 86.6435L197.43 86.644C193.094 93.2068 188.759 99.768 184.28 106.23C181.035 110.876 178.748 116.121 177.55 121.66C179.451 121.668 180.327 120.525 181.128 119.479C181.309 119.243 181.486 119.012 181.67 118.8C186.269 113.742 191.626 109.431 197.55 106.02C206.11 101.12 215.11 98.09 225.11 98.94C230.7 99.42 233.8 102.68 234.11 108.21C234.713 116.098 232.168 123.904 227.03 129.92C218.38 140.3 209.01 149.76 194.38 150.63C190.349 150.869 186.294 150.81 182.061 150.748H182.06C180.088 150.719 178.076 150.69 176.01 150.69C176.047 152.553 176.023 154.361 175.999 156.124V156.124V156.124V156.125C175.927 161.603 175.86 166.65 177.63 171.56C178.194 171.712 178.769 171.816 179.35 171.87C203.84 171.61 219.01 184.59 228.08 206.19C231.56 214.48 228.29 219.57 219.39 220C214.727 220.215 210.064 219.561 205.64 218.07C200.347 216.312 195.198 214.145 190.24 211.59C189.898 213.425 190.755 214.477 191.55 215.453C191.799 215.759 192.042 216.057 192.24 216.37C195.747 221.875 199.293 227.352 202.839 232.829C208.059 240.892 213.279 248.953 218.37 257.1L218.4 257.148L218.4 257.148C223.87 265.902 229.294 274.583 237.09 281.57C248.43 291.7 261.24 295.82 275.66 289.2C313.567 271.733 351.424 254.12 389.23 236.36C405.328 228.799 421.359 221.106 437.391 213.413C445.511 209.516 453.631 205.62 461.76 201.74C466.948 199.263 472.143 196.831 477.633 194.262L477.633 194.262L477.634 194.261C478.948 193.646 480.278 193.023 481.63 192.39ZM62.1101 111.55C64.7531 101.808 69.0342 92.5861 74.7701 84.2798L153.3 117.38C149.373 145.435 150.541 173.969 156.75 201.61C153.076 205.277 148.775 208.291 144.456 211.318L144.455 211.318C142.296 212.831 140.133 214.347 138.04 215.95C129.231 222.704 120.372 229.378 111.511 236.054C104.458 241.367 97.4032 246.682 90.3701 252.04C85.1101 256.04 84.7601 256.12 80.5401 251.04C80.0643 250.467 79.5867 249.896 79.109 249.324C74.2564 243.518 69.399 237.705 66.3401 230.65C65.7788 229.354 65.2756 228.03 64.735 226.609C64.4665 225.903 64.1888 225.173 63.8901 224.41C66.6554 223.41 69.3864 222.421 72.0927 221.441L72.1513 221.42C79.3282 218.821 86.3316 216.285 93.3401 213.77C95.2528 213.09 97.1713 212.422 99.0904 211.754L99.0959 211.752C102.824 210.454 106.554 209.156 110.25 207.77C120.25 204.05 123.81 194.86 118.91 185.65C115.91 179.99 111.09 178.11 104.13 180.44C95.3627 183.37 86.6505 186.46 77.9359 189.551L77.9349 189.551C75.5272 190.405 73.1194 191.259 70.7101 192.11C63.4949 194.657 56.1788 197.264 48.9118 199.853L48.9104 199.854L48.8771 199.865C44.9458 201.266 41.0289 202.662 37.1501 204.04C23.4701 193.53 24.8901 149.24 32.9001 133.87L54.3501 138.87C73.4034 143.33 92.4568 147.793 111.51 152.26C120.33 154.33 126.66 150.74 128.67 142.5C130.68 134.26 126.32 127 118.06 125C106.826 122.292 95.5788 119.656 84.3329 117.019C78.631 115.682 72.9294 114.346 67.2301 113C66.137 112.747 65.058 112.424 63.8621 112.067L63.8614 112.066L63.8607 112.066C63.3066 111.9 62.7274 111.727 62.1101 111.55ZM512 179.06L542.59 166.19C538 164.313 533.664 162.336 529.394 160.389C522.677 157.327 516.122 154.339 509 151.93C509 153.643 508.964 155.334 508.927 157.007C508.761 164.653 508.603 171.914 512 179.06Z"
               fill={fillColor}
            />
         </svg>
      </span>
   );
};