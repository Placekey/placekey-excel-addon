import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        crypto: "readonly",
        Office: "readonly",
        OfficeRuntime: "readonly",
        Excel: "readonly",
        URL: "readonly",
        globalThis: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        // Vite-injected build metadata (see vite.config.js `define`).
        __APP_VERSION__: "readonly",
        __APP_COMMIT__: "readonly",
        __APP_BUILD_DATE__: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
];
