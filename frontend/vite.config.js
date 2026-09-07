import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          name: "Saathi — Support Check-in",
          short_name: "Saathi",
          description:
            "A private space to check in on how you are doing, and a support dashboard for case officers.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#faf7f2",
          theme_color: "#3d8b85",
          orientation: "portrait",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // Check-ins are personal data: never cache API responses to disk.
          // Only the app shell is precached so the UI opens offline.
          navigateFallback: "/index.html",
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "src") },
    },
    server: {
      port: 5173,
      // Optional: set VITE_DEV_PROXY=1 to call the API same-origin via /api.
      proxy: env.VITE_DEV_PROXY
        ? {
            "/api": {
              target: env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/api/, ""),
            },
          }
        : undefined,
    },
  };
});
