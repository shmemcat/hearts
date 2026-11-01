import { MotionProvider } from "./components/MotionProvider";
import { syncMotionPreference } from "./lib/motionPreference";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";

import "@/styles/tailwind.css";
import "@/styles/reset_css.css";
import "@/styles/base_style.css";

import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

syncMotionPreference();
window.addEventListener("storage", syncMotionPreference);

ReactDOM.createRoot(document.getElementById("root")!).render(
   <React.StrictMode>
      <HelmetProvider>
         <BrowserRouter basename={import.meta.env.BASE_URL}>
            <MotionProvider>
               <App />
            </MotionProvider>
         </BrowserRouter>
      </HelmetProvider>
   </React.StrictMode>
);
