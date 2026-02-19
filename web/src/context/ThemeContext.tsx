import React, {
   createContext,
   useContext,
   useEffect,
   useState,
   useCallback,
} from "react";

type ThemeContextValue = {
   theme: string;
   resolvedTheme: string;
   setTheme: (theme: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): string {
   return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
   const [theme, setThemeState] = useState(() => {
      const stored = localStorage.getItem("theme");
      return stored ?? "system";
   });

   const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

   const setTheme = useCallback((next: string) => {
      setThemeState(next);
      if (next === "system") {
         localStorage.removeItem("theme");
      } else {
         localStorage.setItem("theme", next);
      }
   }, []);

   useEffect(() => {
      document.documentElement.setAttribute("data-theme", resolvedTheme);
   }, [resolvedTheme]);

   return (
      <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
         {children}
      </ThemeContext.Provider>
   );
}

export function useTheme(): ThemeContextValue {
   const ctx = useContext(ThemeContext);
   if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
   return ctx;
}
