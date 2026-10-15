import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // server-only бросает исключение вне React Server Components — в тестах это пустой модуль
      "server-only": path.resolve(__dirname, "./tests/stubs/empty.ts"),
    },
  },
});
