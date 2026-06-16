import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default to Node — the pure core/naming tests need no DOM. XML tests
    // opt into a DOM via a `// @vitest-environment happy-dom` file header.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
