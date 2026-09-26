import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://45.196.196.238:3001",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://45.196.196.238:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});