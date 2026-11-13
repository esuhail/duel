/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` makes every asset URL relative, so the same build works on
// GitHub Pages (served from /duel/) and Cloudflare Pages (served from /).
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
