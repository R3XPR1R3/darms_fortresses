import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@darms/shared-types": fileURLToPath(new URL("../../packages/shared-types/src/index.ts", import.meta.url)),
      "@darms/game-core": fileURLToPath(new URL("../../packages/game-core/src/index.ts", import.meta.url)),
    },
  },
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
