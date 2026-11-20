import { defineConfig } from "vite";
export default defineConfig({
  resolve: { dedupe: ["react", "react-dom"] },
  server: { host: "0.0.0.0", port: 5180, allowedHosts: true },
  preview: { host: "0.0.0.0", allowedHosts: true },
  build: { target: "es2020" },
});
