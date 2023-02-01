import React from "react";
import colors from "@/styles/design_tokens.js";

export const HeartsLogo = (props) => {
   const fillColor = colors.heartslogo;

   return (
      <div style={props.style}>
         <svg
            xmlns="http://www.w3.org/2000/svg"
            width="250"
            height="250"
            viewBox="0 0 742 742"
         >
            <path
               d="M616.26,33.66c3.92-3.73,7-7,10.46-9.89a16.21,16.21,0,0,1,11.79-3.68c1.93.1,3.88.07,5.82,0a20.3,20.3,0,0,1,15.61,6.35C677,43.53,694,60.77,711.29,77.61c6.76,6.57,10.2,13.63,9.77,23.31-.35,7.86-3,13.92-8.62,19a57.22,57.22,0,0,1-5.42,3.87c.87,1.07,1.64,2.18,2.58,3.13,6.46,6.51,13,12.9,19.41,19.5s8.54,14.27,5,23.17a14.34,14.34,0,0,1-10.89,9c-5.79,1.2-11.73,1.62-17.61,2.37q-11.67,1.49-23.33,2.93c-4,.49-8,.85-12,1.33-11.95,1.42-24,2.51-35.83,4.41-9.51,1.52-14.43,10.74-12.77,20.39,1.41,8.23,2.64,16.48,4,24.71,1.59,9.44,3.66,18.81,4.79,28.3,1.45,12.3,5,24.4,3.7,37-.6,5.84-3.35,10.7-6.22,15.5-3.59,6-9,10.26-15.11,13.6-15.71,8.63-31.49,17.12-47.18,25.78-22,12.14-43.89,24.45-65.89,36.57-16.46,9.08-33.06,17.91-49.53,27-18.77,10.33-37.44,20.86-56.21,31.21-12.61,6.95-25.36,13.68-38,20.64-18.77,10.35-37.46,20.83-56.2,31.22q-15.21,8.44-30.46,16.8-24.06,13.14-48.15,26.22c-4.43,2.4-9,3.39-14.16,2-8.95-2.49-17.24-13.92-11.41-25.24,3.3-6.41,6.66-12.78,10.13-19.1,4.66-8.47,9.49-16.83,14.16-25.29Q237,446,254,415.06c6.76-12.32,13.39-24.72,20.18-37,10.43-18.92,21-37.78,31.42-56.69,6-10.91,12-21.86,18-32.79q17-30.93,34.07-61.86c6.93-12.63,13.69-25.35,20.65-38q15.53-28.15,31.23-56.19c2.05-3.67,3.94-7.51,6.52-10.78a38.39,38.39,0,0,1,26.12-15c7.34-1,14-.7,21.07,1.86,5,1.8,10.61,1.7,15.93,2.55,8.07,1.28,16.11,2.73,24.19,4q12.39,1.89,24.84,3.43c3.42.42,7.06,1.26,10.31.55,9.05-2,13.22-7.82,14.05-17.29.73-8.32,2-16.58,3-24.89,1.16-10,2.16-20.13,3.35-30.18.88-7.44,2-14.84,2.94-22.27.28-2.26-.15-4.69.5-6.81a17.4,17.4,0,0,1,7.18-9.53C572.8,6,576.33,5.77,580.44,6c7.49.37,12.42,4,17.18,9C603.87,21.35,610.25,27.64,616.26,33.66ZM441.68,124.49A116.11,116.11,0,0,0,455,152.78c5.66,8.68,11.31,17.51,20.2,23.31a102,102,0,0,0,14,7.13c5,2.26,7.47,7,5.81,12-1.54,4.72-6.25,7-11.52,5.13a88.78,88.78,0,0,1-13.39-6c-12.26-6.91-21.17-17.35-28.54-29-5.32-8.45-9.83-17.42-14.72-26.19-.25.21-.78.46-1,.88q-14.14,25.61-28.25,51.24c-6.67,12.17-13.24,24.41-19.92,36.57q-16.87,30.72-33.83,61.4c-6.44,11.7-12.79,23.45-19.24,35.15q-16.28,29.53-32.62,59c-6.9,12.45-13.87,24.86-20.74,37.32-3.38,6.14-6.59,12.36-10.12,19,20.14,6.61,33.42,19.82,40,40,2.88-1.48,5.4-2.69,7.83-4,5.23-2.88,10.39-5.9,15.63-8.77,11.86-6.49,23.79-12.89,35.65-19.41,20.32-11.18,40.59-22.44,60.91-33.62C433,407.41,445,401,456.8,394.48c19.54-10.77,39-21.63,58.57-32.4,11.85-6.53,23.77-12.94,35.63-19.45q26.34-14.44,52.65-29a32.36,32.36,0,0,0,5.3-3.37c7.56-6.34,8.06-15,6.81-23.7-1.71-11.89-4.12-23.67-6-35.53-1.64-10.32-2.78-20.72-4.5-31-1.51-9-3.54-17.84.1-26.75l-15.94-9c-1.45,4.28-2.76,8.07-4,11.88-3.59,10.81-7.08,21.65-10.77,32.44-1.78,5.21-7.09,7.8-11.79,6.06-4.39-1.63-6.79-6.85-5.35-11.69.61-2,1.28-4,1.94-6,4.53-13.64,9-27.3,13.62-40.92.92-2.73,1-5-1.23-7.21s-4.28-2-6.76-1c-2.14.79-4.31,1.48-6.48,2.18q-21,6.83-42,13.64a6.31,6.31,0,0,1-6.38-.9c-6.34-4.76-5.85-12.55,1.22-16.1a29.92,29.92,0,0,1,3.9-1.56q18.69-6.28,37.38-12.56c1.26-.43,2.46-1,3.87-1.61L547.93,136c-5.93.54-11.58,2.05-16.95,1.37-15.18-1.94-30.25-4.77-45.35-7.25-8.43-1.38-16.82-3-25.28-4.09C454.32,125.23,448.21,125,441.68,124.49ZM717.13,161a19.51,19.51,0,0,0-1.51-2.52c-8.08-8.13-16.23-16.19-24.24-24.38-1.87-1.92-3.43-1.71-5.59-.67Q668,141.9,650,150.2c-5.89,2.73-11.89,5.21-17.8,7.9a7.11,7.11,0,0,1-7-.6c-6.26-3.76-6.37-11.6,0-15.41A136.14,136.14,0,0,1,637.47,136c19.73-9.22,39.52-18.3,59.18-27.65,7.89-3.75,8.9-10.8,2.7-17q-24.81-24.93-49.76-49.73c-6.26-6.22-13.05-5-17.1,2.9-1.76,3.44-3.2,7-4.84,10.53q-8.5,18.09-17.06,36.16c-3.76,7.94-7.42,15.93-11.37,23.78a9,9,0,0,1-12.64,3.73,9.16,9.16,0,0,1-3.67-11.88Q594.19,83,605.45,59.18c1.17-2.5,2.1-5.12,3.22-7.88-8.62-8.58-17.08-17.06-25.62-25.46-.84-.81-2.18-1.1-4.22-2.09,0,4.44.37,7.81-.06,11.07-1.54,11.74-3.5,23.42-5,35.16-1.28,10-1.91,20.15-3.34,30.16-.85,6-.3,12.67-4,17.69-4.09,5.49-2.5,9.92.54,14.73.94,1.48,1.73,3.05,2.61,4.57,6.11,10.51,14.81,18.85,23.83,26.64,6,5.2,13.43,8.79,20.26,13,1.93,1.2,3.64,1,5.76-.42a27.93,27.93,0,0,1,15.29-5A96.1,96.1,0,0,0,645,170.17c7.43-1,14.85-2,22.28-2.93,4.32-.55,8.66-.93,13-1.46q10.89-1.35,21.78-2.79C706.85,162.36,711.62,161.7,717.13,161ZM283.5,489.69a13.43,13.43,0,0,0,.14-2.51c-2.29-13.56-12.41-25.48-25.93-28.9-6.28-1.59-6.27-1.57-9.34,4.07-4.78,8.8-9.52,17.61-14.36,26.38-6.52,11.83-13.13,23.62-19.67,35.45a43.08,43.08,0,0,0-1.73,4.5Z"
               fill={fillColor}
            />
            <path
               d="M106.34,730.21c-1.25-1.19-2.42-2.25-3.53-3.36q-38.18-38.16-76.36-76.32C13.8,637.94,8.16,622.61,9.68,605.12c2.2-25.35,18.69-45.14,43.83-51.27,15.83-3.85,31.4-1.63,45.34,7.82,2.32,1.57,4.69,3.06,7.05,4.57.13.08.34,0,0,0,5.57-3.33,10.55-7,16.09-9.5,18.36-8.14,36.51-7.35,53.87,3,14.92,8.88,23.71,22.42,26.87,39.19,1.21,6.38,0,13.26-.43,19.89-.59,9.83-5.16,18.08-10.8,25.84a30.25,30.25,0,0,1-3.09,3.6q-40,40.07-80.06,80.1C107.79,729,107.11,729.52,106.34,730.21Z"
               fill={fillColor}
            />
            <path
               d="M717.13,161c-5.51.75-10.28,1.41-15,2q-10.89,1.42-21.78,2.79c-4.33.53-8.67.91-13,1.46-7.43.94-14.85,2-22.28,2.93a96.1,96.1,0,0,1-10.37,1.23,27.93,27.93,0,0,0-15.29,5c-2.12,1.43-3.83,1.62-5.76.42-6.83-4.23-14.25-7.82-20.26-13-9-7.79-17.72-16.13-23.83-26.64-.88-1.52-1.67-3.09-2.61-4.57-3-4.81-4.63-9.24-.54-14.73,3.75-5,3.2-11.7,4-17.69,1.43-10,2.06-20.13,3.34-30.16,1.51-11.74,3.47-23.42,5-35.16.43-3.26.06-6.63.06-11.07,2,1,3.38,1.28,4.22,2.09,8.54,8.4,17,16.88,25.62,25.46-1.12,2.76-2,5.38-3.22,7.88Q594.23,83,582.91,106.77a9.16,9.16,0,0,0,3.67,11.88,9,9,0,0,0,12.64-3.73c3.95-7.85,7.61-15.84,11.37-23.78Q619.14,73.07,627.65,55c1.64-3.5,3.08-7.09,4.84-10.53,4-7.93,10.84-9.12,17.1-2.9q25,24.78,49.76,49.73c6.2,6.24,5.19,13.29-2.7,17C677,117.67,657.2,126.75,637.47,136a136.14,136.14,0,0,0-12.27,6.12c-6.37,3.81-6.26,11.65,0,15.41a7.11,7.11,0,0,0,7,.6c5.91-2.69,11.91-5.17,17.8-7.9q17.93-8.31,35.76-16.82c2.16-1,3.72-1.25,5.59.67,8,8.19,16.16,16.25,24.24,24.38A19.51,19.51,0,0,1,717.13,161Z"
               fill-opacity="0"
            />
         </svg>
      </div>
   );
};
