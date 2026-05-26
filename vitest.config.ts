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
      // Orchestrator / wiring / I/O code is covered by the e2e script and
      // production smoke checks, not by unit tests. Excluding it from the
      // coverage gate keeps the metric honest — what we DO unit-test stays
      // ≥85% (pipeline, validator, guard, optimizer, repositories, clients).
      exclude: [
        '**/*.d.ts',
        '**/index.ts',
        '**/types.ts',
        '**/schemas/**',
        'apps/api/src/server.ts',
        'apps/api/src/api.ts',
        'apps/api/src/routes/**',
        'apps/api/src/application/*.ts', // top-level use-cases; _lib/ keeps coverage
        'apps/api/src/infra/config.ts',
        'apps/api/src/infra/_lib/zod-issues.ts',
        'apps/api/src/infra/cache/dynamo-cache.repository.ts',
      ],
      thresholds: {
        lines: 70,
        branches: 65,
        functions: 70,
        statements: 70,
      },
    },
  },
});
