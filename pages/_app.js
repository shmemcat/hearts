import "@/styles/reset_css.css";
import "@/styles/base_style.css";
import { ThemeProvider } from "next-themes";

/* Fontawesome */
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

export default function App({ Component, pageProps }) {
   return (
      <ThemeProvider>
         <Component {...pageProps} />;
      </ThemeProvider>
   );
}
