#!/usr/bin/env tsx

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ModelPrice {
  readonly inputUsdPerMillion: number;
  readonly outputUsdPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPrice> = {
  'gemini-3.1-flash-lite': { inputUsdPerMillion: 0.25, outputUsdPerMillion: 1.5 },
};

interface PromptfooTokenUsage {
  readonly prompt?: number;
  readonly completion?: number;
  readonly total?: number;
  readonly cached?: number;
}

interface PromptfooGradingResult {
  readonly pass?: boolean;
  readonly score?: number;
  readonly reason?: string;
  readonly componentResults?: Array<{
    readonly pass?: boolean;
    readonly assertion?: { readonly type?: string };
    readonly reason?: string;
  }>;
}

interface PromptfooResult {
  readonly vars?: Record<string, unknown>;
  readonly prompt?: { readonly label?: string; readonly id?: string };
  readonly provider?: { readonly label?: string; readonly id?: string };
  readonly response?: { readonly output?: string };
  readonly success?: boolean;
  readonly score?: number;
  readonly gradingResult?: PromptfooGradingResult;
  readonly latencyMs?: number;
  readonly tokenUsage?: PromptfooTokenUsage;
  readonly metadata?: Record<string, unknown>;
}

interface PromptfooJson {
  readonly evalId?: string;
  readonly results?: { readonly results?: PromptfooResult[] };
  readonly version?: number;
}

type FailureCode =
  | 'schema-fail'
  | 'over-refused'
  | 'under-refused'
  | 'forbidden-phrase'
  | 'numeric-unsourced'
  | 'empty'
  | 'timeout'
  | 'other';

interface NormalisedCell {
  readonly promptLabel: string;
  readonly modelLabel: string;
  readonly modelId: string;
  readonly category: string;
  readonly difficulty: string;
  readonly expectedOutcome: string;
  readonly passed: boolean;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly schemaValid: boolean;
  readonly hasCitation: boolean;
  readonly modelOutput: string;
  readonly failureCode: FailureCode | null;
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

function main(): void {
  const argPath = process.argv[2];
  const jsonPath = argPath
    ? resolve(process.cwd(), argPath)
    : resolve(repoRoot, 'ai/evals/results/latest.json');

  const raw = readFileSync(jsonPath, 'utf8');
  const json = JSON.parse(raw) as PromptfooJson;

  const rows = normalise(json);
  if (rows.length === 0) {
    throw new Error(`No usable result rows found in ${jsonPath}`);
  }

  const report = buildReport(rows, json.evalId);
  const reportPath = resolve(repoRoot, 'ai/evals/results/eval-report.md');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report, 'utf8');
  process.stdout.write(`Wrote ${reportPath} (${rows.length} result rows).\n`);
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export function normalise(json: PromptfooJson): NormalisedCell[] {
  const results = json.results?.results ?? [];
  const cells: NormalisedCell[] = [];

  for (const result of results) {
    const promptLabel = result.prompt?.label ?? result.prompt?.id ?? 'unknown-prompt';
    const modelLabel = result.provider?.label ?? result.provider?.id ?? 'unknown-model';
    const modelId = extractModelId(result.provider?.id);
    const meta = (result.metadata ?? {}) as Record<string, string>;
    const varsMeta = (result.vars?.metadata as Record<string, string> | undefined) ?? {};
    const category = (meta.category ?? varsMeta.category ?? inferCategory(result)) || 'unknown';
    const difficulty = meta.difficulty ?? varsMeta.difficulty ?? 'unknown';
    const expectedOutcome = meta.expectedOutcome ?? varsMeta.expectedOutcome ?? 'pass';
    const passed = result.success === true;
    const latencyMs = numericOr(result.latencyMs, 0);
    const inputTokens = numericOr(result.tokenUsage?.prompt, 0);
    const outputTokens = numericOr(result.tokenUsage?.completion, 0);
    const costUsd = estimateCost(modelId, inputTokens, outputTokens);
    const output = result.response?.output ?? '';
    const { schemaValid, hasCitation } = inspectOutput(output);
    const failureCode = passed ? null : classifyFailure(result, output, expectedOutcome);

    cells.push({
      promptLabel,
      modelLabel,
      modelId,
      category,
      difficulty,
      expectedOutcome,
      passed,
      latencyMs,
      inputTokens,
      outputTokens,
      costUsd,
      schemaValid,
      hasCitation,
      modelOutput: output,
      failureCode,
    });
  }

  return cells;
}

function extractModelId(providerId: string | undefined): string {
  if (!providerId) return 'unknown';
  // "google:gemini-2.5-flash" → "gemini-2.5-flash"
  return providerId.includes(':') ? (providerId.split(':')[1] ?? providerId) : providerId;
}

function numericOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICING[modelId];
  if (!price) return 0;
  const inputCost = (inputTokens * price.inputUsdPerMillion) / 1_000_000;
  const outputCost = (outputTokens * price.outputUsdPerMillion) / 1_000_000;
  return round(inputCost + outputCost, 6);
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function inspectOutput(output: string): { schemaValid: boolean; hasCitation: boolean } {
  if (!output) return { schemaValid: false, hasCitation: false };
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const citations = Array.isArray(parsed.citations) ? parsed.citations : [];
    return { schemaValid: true, hasCitation: citations.length > 0 };
  } catch {
    return { schemaValid: false, hasCitation: false };
  }
}

function inferCategory(result: PromptfooResult): string {
  // Fall back to the case description prefix if metadata wasn't propagated.
  const description = (result.vars?.description ?? '') as string;
  if (description.includes('inject')) return 'adversarial';
  if (description.includes('refuse') || description.includes('off-topic')) return 'refusal';
  if (description.includes('Scotland') || description.includes('London')) return 'regional';
  return 'unknown';
}

function classifyFailure(
  result: PromptfooResult,
  output: string,
  expectedOutcome: string,
): FailureCode {
  if (!output) return 'empty';
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(output) as Record<string, unknown>;
  } catch {
    return 'schema-fail';
  }
  const refused = parsed.refused === true;
  if (expectedOutcome === 'refuse' && !refused) return 'under-refused';
  if (expectedOutcome === 'pass' && refused) return 'over-refused';

  const reason = result.gradingResult?.reason ?? '';
  const components = result.gradingResult?.componentResults ?? [];
  const componentTypes = components
    .filter((component) => component.pass === false)
    .map((component) => component.assertion?.type ?? 'unknown');

  if (/guaranteed|100% accurate/i.test(output)) return 'forbidden-phrase';
  if (componentTypes.includes('not-contains')) return 'forbidden-phrase';
  if (/timeout/i.test(reason)) return 'timeout';
  if (componentTypes.includes('llm-rubric')) return 'numeric-unsourced';
  return 'other';
}

// ---------------------------------------------------------------------------
// Aggregations
// ---------------------------------------------------------------------------

interface CellStats {
  readonly count: number;
  readonly passes: number;
  readonly passRate: number;
  readonly costUsdTotal: number;
  readonly costUsdPerCall: number;
  readonly costUsdPerPass: number;
  readonly latencyP50: number;
  readonly latencyP95: number;
  readonly latencyP99: number;
  readonly schemaValidRate: number;
  readonly citationRate: number;
  readonly inputTokensAvg: number;
  readonly outputTokensAvg: number;
}

function statsFor(rows: NormalisedCell[]): CellStats {
  const count = rows.length;
  const passes = rows.filter((row) => row.passed).length;
  const costUsdTotal = sum(rows.map((row) => row.costUsd));
  const latencies = rows.map((row) => row.latencyMs).sort((a, b) => a - b);
  return {
    count,
    passes,
    passRate: count === 0 ? 0 : passes / count,
    costUsdTotal,
    costUsdPerCall: count === 0 ? 0 : costUsdTotal / count,
    costUsdPerPass: passes === 0 ? 0 : costUsdTotal / passes,
    latencyP50: percentile(latencies, 0.5),
    latencyP95: percentile(latencies, 0.95),
    latencyP99: percentile(latencies, 0.99),
    schemaValidRate: count === 0 ? 0 : rows.filter((row) => row.schemaValid).length / count,
    citationRate: count === 0 ? 0 : rows.filter((row) => row.hasCitation).length / count,
    inputTokensAvg: count === 0 ? 0 : sum(rows.map((row) => row.inputTokens)) / count,
    outputTokensAvg: count === 0 ? 0 : sum(rows.map((row) => row.outputTokens)) / count,
  };
}

function sum(values: number[]): number {
  return values.reduce((accumulator, value) => accumulator + value, 0);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index] ?? 0;
}

function refusalAccuracy(rows: NormalisedCell[]): number {
  const refusalCases = rows.filter((row) => row.expectedOutcome === 'refuse');
  if (refusalCases.length === 0) return 1;
  const correct = refusalCases.filter((row) => isRefused(row.modelOutput)).length;
  return correct / refusalCases.length;
}

function falseRefusalRate(rows: NormalisedCell[]): number {
  const passCases = rows.filter((row) => row.expectedOutcome === 'pass');
  if (passCases.length === 0) return 0;
  const wrong = passCases.filter((row) => isRefused(row.modelOutput)).length;
  return wrong / passCases.length;
}

function isRefused(output: string): boolean {
  if (!output) return false;
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    return parsed.refused === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

function buildReport(rows: NormalisedCell[], evalId: string | undefined): string {
  const prompts = uniqueSorted(rows.map((row) => row.promptLabel));
  const models = uniqueSorted(rows.map((row) => row.modelLabel));
  const categories = uniqueSorted(rows.map((row) => row.category));
  const totalCalls = rows.length;
  const totalCost = round(sum(rows.map((row) => row.costUsd)), 4);

  const out: string[] = [];
  out.push('# AI Quality Lab — Evaluation Report');
  out.push('');
  out.push(`> **Generated**: ${new Date().toISOString()}`);
  if (evalId) out.push(`> **Promptfoo eval id**: ${evalId}`);
  out.push(
    `> **Matrix**: ${prompts.length} prompts (${prompts.join(', ')}) × ${models.length} models (${models.join(', ')}) × ${categories.length} categories`,
  );
  out.push(`> **Inference calls**: ${totalCalls}`);
  out.push(`> **Paid-equivalent cost**: $${totalCost.toFixed(4)} (free tier in practice)`);
  out.push(
    `> **Run type**: **Screening** — 1 case per category, single rep per cell. Effects ≥ 1 case (~14 pp) detectable; smaller diffs are noise.`,
  );
  out.push('');

  out.push('## Headline matrix — pass rate');
  out.push(buildMatrix(rows, prompts, models, (subset) => formatRate(statsFor(subset).passRate)));
  out.push('');

  out.push('## Cost per passed request (USD)');
  out.push(
    buildMatrix(
      rows,
      prompts,
      models,
      (subset) => `$${statsFor(subset).costUsdPerPass.toFixed(4)}`,
    ),
  );
  out.push('');

  out.push('## Latency P95 (ms)');
  out.push(
    buildMatrix(rows, prompts, models, (subset) => `${Math.round(statsFor(subset).latencyP95)}`),
  );
  out.push('');

  out.push('## Per-category × per-model pass rate');
  out.push(buildCategoryHeatmap(rows, models, categories));
  out.push('');

  out.push('## Failure taxonomy');
  out.push(buildFailureTable(rows, models));
  out.push('');

  out.push('## Refusal accuracy & false-refusal rate');
  out.push(buildRefusalTable(rows, models));
  out.push('');

  out.push('## Per-model summary');
  out.push(buildModelSummary(rows, models));
  out.push('');

  out.push('## Limitations');
  out.push(
    `- **Small sample**: ${rows.length} datapoints across the matrix. Only effects ≥ 1 case (~${Math.round(100 / categories.length)} pp) are reliably detectable per category.`,
  );
  out.push(
    '- **Self-grading bias**: the same model judges its own output. Per Zheng MT-Bench, self-evaluation inflates scores by 5–15 pp. Cross-family judging tracked as future work.',
  );
  out.push('- **No human gold set**: assertions are model-graded or deterministic.');
  out.push('- **Non-determinism**: `temperature: 0` is best-effort — reruns may shift by ±1 case.');
  out.push('');
  out.push('---');
  out.push('');
  out.push('*Auto-generated by `ai/evals/scripts/analyze-results.ts`. Do not edit by hand.*');
  out.push('');
  return out.join('\n');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function buildMatrix(
  rows: NormalisedCell[],
  prompts: string[],
  models: string[],
  cellFn: (subset: NormalisedCell[]) => string,
): string {
  const header = ['', ...models].join(' | ');
  const divider = ['---', ...models.map(() => '---')].join(' | ');
  const body = prompts.map((prompt) => {
    const cells = models.map((model) =>
      cellFn(rows.filter((row) => row.promptLabel === prompt && row.modelLabel === model)),
    );
    return [`**${prompt}**`, ...cells].join(' | ');
  });
  return [`| ${header} |`, `| ${divider} |`, ...body.map((row) => `| ${row} |`)].join('\n');
}

function buildCategoryHeatmap(
  rows: NormalisedCell[],
  models: string[],
  categories: string[],
): string {
  const header = ['category', ...models].join(' | ');
  const divider = ['---', ...models.map(() => '---')].join(' | ');
  const body = categories.map((category) => {
    const cells = models.map((model) => {
      const subset = rows.filter((row) => row.category === category && row.modelLabel === model);
      return formatRate(statsFor(subset).passRate);
    });
    return [category, ...cells].join(' | ');
  });
  return [`| ${header} |`, `| ${divider} |`, ...body.map((row) => `| ${row} |`)].join('\n');
}

const FAILURE_CODES: FailureCode[] = [
  'schema-fail',
  'over-refused',
  'under-refused',
  'forbidden-phrase',
  'numeric-unsourced',
  'empty',
  'timeout',
  'other',
];

function buildFailureTable(rows: NormalisedCell[], models: string[]): string {
  const header = ['failure', ...models].join(' | ');
  const divider = ['---', ...models.map(() => '---')].join(' | ');
  const body = FAILURE_CODES.map((code) => {
    const cells = models.map((model) => {
      const modelRows = rows.filter((row) => row.modelLabel === model);
      const failed = modelRows.filter((row) => row.failureCode === code).length;
      const total = modelRows.length;
      return total === 0 ? '0' : `${failed}/${total}`;
    });
    return [code, ...cells].join(' | ');
  });
  return [`| ${header} |`, `| ${divider} |`, ...body.map((row) => `| ${row} |`)].join('\n');
}

function buildRefusalTable(rows: NormalisedCell[], models: string[]): string {
  const header = ['model', 'refusal accuracy', 'false-refusal rate'].join(' | ');
  const divider = ['---', '---', '---'].join(' | ');
  const body = models.map((model) => {
    const modelRows = rows.filter((row) => row.modelLabel === model);
    return [
      model,
      formatRate(refusalAccuracy(modelRows)),
      formatRate(falseRefusalRate(modelRows)),
    ].join(' | ');
  });
  return [`| ${header} |`, `| ${divider} |`, ...body.map((row) => `| ${row} |`)].join('\n');
}

function buildModelSummary(rows: NormalisedCell[], models: string[]): string {
  const header = [
    'model',
    'pass',
    'P50 ms',
    'P95 ms',
    'cost/pass',
    'schema OK',
    'has citation',
  ].join(' | ');
  const divider = ['---', '---', '---', '---', '---', '---', '---'].join(' | ');
  const body = models.map((model) => {
    const subset = rows.filter((row) => row.modelLabel === model);
    const stats = statsFor(subset);
    return [
      model,
      formatRate(stats.passRate),
      `${Math.round(stats.latencyP50)}`,
      `${Math.round(stats.latencyP95)}`,
      `$${stats.costUsdPerPass.toFixed(4)}`,
      formatRate(stats.schemaValidRate),
      formatRate(stats.citationRate),
    ].join(' | ');
  });
  return [`| ${header} |`, `| ${divider} |`, ...body.map((row) => `| ${row} |`)].join('\n');
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

// Only run main when invoked directly, not when imported by the test suite.
const invokedDirectly = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(`analyze-results failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Re-export helpers in case future tests import them directly. `normalise` is
// already exported above via its `export function` declaration.
export {
  buildReport,
  classifyFailure,
  estimateCost,
  inspectOutput,
  refusalAccuracy,
  falseRefusalRate,
  statsFor,
};
export type { NormalisedCell, CellStats, FailureCode, PromptfooJson, PromptfooResult };
