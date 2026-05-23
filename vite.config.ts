import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import { VitePWA } from "vite-plugin-pwa";

const pwa = VitePWA({
  registerType: "autoUpdate",
  includeAssets: [
    "favicon.svg",
    "favicon.ico",
    "apple-touch-icon-180x180.png",
    "pwa-64x64.png",
    "pwa-192x192.png",
    "pwa-512x512.png",
    "maskable-icon-512x512.png",
  ],
  manifest: {
    id: "/taskmaster/",
    name: "TaskMaster",
    short_name: "TaskMaster",
    description: "Personal offline-first task manager",
    theme_color: "#181818",
    background_color: "#181818",
    display: "standalone",
    scope: "/taskmaster/",
    start_url: "/taskmaster/",
    icons: [
      {
        src: "pwa-64x64.png",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
  },
});

export default defineConfig({
  base: "/taskmaster/",
  plugins: [solid(), pwa],
  test: {
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
  },
});
