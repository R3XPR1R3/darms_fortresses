import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/ws": {
        target: "ws://localhost:4000",
        ws: true,
      },
    },
  },
});
