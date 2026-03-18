import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    // Next app pages use jsx "preserve"; Vitest must emit JSX runtime for RSC smoke tests.
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    globals: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
