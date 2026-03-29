import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { VitePWA } from "vite-plugin-pwa";

const pwa = VitePWA({
  registerType: "autoUpdate",
  includeAssets: ["favicon.svg"],
  manifest: {
    name: "TaskMaster",
    short_name: "TaskMaster",
    description: "Personal offline-first task manager",
    theme_color: "#1a1a2e",
    background_color: "#1a1a2e",
    display: "standalone",
    scope: "/taskmaster/",
    start_url: "/taskmaster/",
    icons: [
      {
        src: "pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
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
});
