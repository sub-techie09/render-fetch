import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: process.env.INTEGRATION_TESTS
      ? ['tests/**/*.test.ts']
      : ['tests/unit/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
