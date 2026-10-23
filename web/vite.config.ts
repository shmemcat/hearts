/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { privateBoundary } from "./dev/private-boundary";

export default defineConfig(({ mode }) => ({
   base: loadEnv(mode, process.cwd(), "VITE_").VITE_BASE_PATH || "/",
   plugins: [react(), tailwindcss(), privateBoundary()],
   resolve: {
      alias: {
         "@": path.resolve(__dirname, "./src"),
      },
   },
   test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.tsx",
      css: { modules: { classNameStrategy: "non-scoped" } },
      include: ["src/**/*.test.{ts,tsx}"],
   },
   server: {
      port: 5173,
      proxy: {
         "/api/hearts/": {
            target: process.env.HEARTS_API_TARGET || process.env.CARDS_API_TARGET || "http://127.0.0.1:5000",
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/api\/hearts/, ""),
         },
         "^/hearts/socket\\.io(?:/|\\?|$)": {
            target: process.env.HEARTS_API_TARGET || process.env.CARDS_API_TARGET || "http://127.0.0.1:5000",
            changeOrigin: true,
            ws: true,
            rewrite: (p) =>
               p.replace(/^\/hearts\/socket\.io\/?/, "/socket.io/"),
         },
         "^/api/(?:games|lobbies|stats|preferences|leaderboard)(?:/|\\?|$)": {
            target: process.env.HEARTS_API_TARGET || process.env.CARDS_API_TARGET || "http://127.0.0.1:5000",
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/api/, ""),
         },
         "/api": {
            target: process.env.CARDS_API_TARGET || "http://127.0.0.1:5000",
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/api/, ""),
         },
         "/socket.io": {
            target: process.env.CARDS_API_TARGET || "http://127.0.0.1:5000",
            changeOrigin: true,
            ws: true,
            rewrite: (p) => p.replace(/^\/socket\.io\/?/, "/socket.io/"),
         },
      },
   },
}));
