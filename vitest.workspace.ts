// Vitest monorepo workspace — runs both backend (node env) and frontend
// (jsdom + testing-library) tests via a single `npm test` from the repo root.
export default ['./vitest.config.ts', './apps/web/vitest.config.ts'];
