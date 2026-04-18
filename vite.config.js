import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src",
  publicDir: resolve(__dirname, "public"),
  base: "./",
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        taskpane: resolve(__dirname, "src/taskpane.html"),
        commands: resolve(__dirname, "src/commands.html"),
        apikey: resolve(__dirname, "src/apikey.html"),
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  test: {
    globals: false,
    environment: "node",
    include: ["../test/**/*.test.mjs"],
  },
});
