import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png", "icons/favicon.svg"],
      manifest: {
        name: "Daybook",
        short_name: "Daybook",
        description: "Habits, tasks, food, money, training and steps in one place.",
        theme_color: "#0f0d0b",
        background_color: "#0f0d0b",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.endsWith("/foods.json"), handler: "StaleWhileRevalidate", options: { cacheName: "food-db" } },
          { urlPattern: ({ url }) => /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname), handler: "StaleWhileRevalidate", options: { cacheName: "fonts" } },
          { urlPattern: ({ url }) => url.hostname === "cdn.jsdelivr.net", handler: "CacheFirst", options: { cacheName: "libs" } },
        ],
      },
    }),
  ],
});
