"use client";

import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 768) {
   const [mobile, setMobile] = useState(false);
   useEffect(() => {
      const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
      setMobile(mql.matches);
      const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
   }, [breakpoint]);
   return mobile;
}
