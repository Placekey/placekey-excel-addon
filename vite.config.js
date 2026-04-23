import { defineConfig } from "vite";
import { resolve } from "path";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));

function getCommit() {
  // GitHub Actions sets GITHUB_SHA on every run.
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const buildInfo = {
  version: pkg.version,
  commit: getCommit(),
  date: new Date().toISOString().slice(0, 10),
};

export default defineConfig({
  root: "src",
  publicDir: resolve(__dirname, "public"),
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(buildInfo.version),
    __APP_COMMIT__: JSON.stringify(buildInfo.commit),
    __APP_BUILD_DATE__: JSON.stringify(buildInfo.date),
  },
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
