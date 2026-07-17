import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Component render tests (.test.tsx) use JSX — use React's automatic runtime so
  // they need no explicit `import React`. Harmless for the JSX-free .test.ts files.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Default env is Node (source-scan + pure-domain tests). Component render tests
    // opt into jsdom per-file via a `// @vitest-environment jsdom` docblock.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
