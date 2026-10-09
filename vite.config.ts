import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap:false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/locales/en.json")) return "english";
          if (id.includes("/locales/he.json") || id.includes("/locales/source-keys.json")) return "hebrew";
          if (id.includes("node_modules/leaflet/")) return "leaflet";
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "react";
        },
      },
    },
  },
});
