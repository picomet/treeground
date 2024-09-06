import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  middleware: "./src/middleware.ts",
  server: {
    experimental: {
      websocket: true,
    },
  },
}).addRouter({
  name: "party",
  type: "http",
  handler: "./src/websocket.ts",
  target: "server",
  base: "/tg",
  middleware: "./src/middleware.ts",
});
