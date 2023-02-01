import "@/styles/reset_css.css";
import "@/styles/base_style.css";
import localFont from "@next/font/local";
import { ThemeProvider } from "next-themes";

/* Fontawesome */
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

export default function App({ Component, pageProps }) {
   return (
      <>
         <style jsx global>{`
            :root {
               --appFont: ${terminalDosis.style.fontFamily};
            }
         `}</style>
         <ThemeProvider>
            <Component {...pageProps} />
         </ThemeProvider>
      </>
   );
}

const terminalDosis = localFont({
   src: [
      {
         path: "../public/fonts/TerminalDosis-Regular.ttf",
         weight: "400",
      },
      {
         path: "../public/fonts/TerminalDosis-SemiBold.ttf",
         weight: "600",
      },
      {
         path: "../public/fonts/TerminalDosis-Bold.ttf",
         weight: "700",
      },
      {
         path: "../public/fonts/TerminalDosis-ExtraBold.ttf",
         weight: "900",
      },
   ],
});
