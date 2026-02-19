import Head from "next/head";
import "@/styles/tailwind.css";
import "@/styles/reset_css.css";
import "@/styles/base_style.css";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { CardStyleProvider } from "@/context/CardStyleContext";
import { SoundProvider } from "@/context/SoundContext";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";

/* Fontawesome */
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

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

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <>
      <Head>
        <link rel="icon" href="/images/favicon.ico" />
        <meta name="description" content="Hearts web application" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <ThemeProvider>
        <AuthProvider>
          <CardStyleProvider>
            <SoundProvider>
              <div className={terminalDosis.className}>
                <AnimatePresence mode="wait">
                  <motion.div key={router.pathname}>
                    <Component {...pageProps} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </SoundProvider>
          </CardStyleProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
