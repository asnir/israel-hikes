import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import {preparePhotos} from "./scripts/photo-assets.mjs";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [{name:"licensed-photo-assets",configResolved(){preparePhotos()},closeBundle(){const manifest=JSON.parse(fs.readFileSync("public/photos/encoded-assets.json","utf8"));for(const asset of manifest)fs.rmSync(path.join("dist",asset.path+".base64"),{force:true})}},react()],
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
