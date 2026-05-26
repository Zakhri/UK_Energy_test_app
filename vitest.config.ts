import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'apps/api/test/**/*.{test,spec}.ts',
      'packages/shared/src/**/*.{test,spec}.ts',
      'ai/evals/scripts/**/*.{test,spec}.ts',
    ],
    exclude: ['node_modules', 'dist', '.aws-sam', 'apps/web/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['apps/api/src/**/*.ts', 'packages/shared/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/index.ts', '**/types.ts', '**/schemas/**'],
      thresholds: {
        lines: 70,
        branches: 65,
        functions: 70,
        statements: 70,
      },
    },
  },
});
