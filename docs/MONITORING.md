# Monitoring & Observability

What the system records on every AI request, how it surfaces, and what we would wire into CloudWatch alarms before going to production. Companion to the README — open this when you need to know what shows up in logs or how an SRE would catch a regression.

---

## 1. What we log on every AI call

Every Lambda invocation that reaches the AI pipeline emits **one structured JSON line** at log-level `info` with the prefix `"msg":"ai call complete"`. The envelope is defined in `apps/api/src/infra/ai/telemetry.ts` and persisted into the DynamoDB single-table under `LOG#<yyyy-mm-dd> / REQ#<ulid>` with a 30-day TTL.

| Field               | Type    | Notes                                                                      |
| ------------------- | ------- | -------------------------------------------------------------------------- |
| `requestId`         | string  | API Gateway trace ID (`Root=1-…`) — joins API logs + AI logs               |
| `modelId`           | string  | `gemini-3.1-flash-lite` (primary) or `gemini-3.5-flash` (fallback cascade) |
| `promptVersion`     | string  | `v1` — bumps on prompt change, part of cache key                           |
| `promptHash`        | string  | 16-char SHA-256 of the rendered prompt (cache invalidation signal)         |
| `latencyMs`         | number  | End-to-end inference time (excludes our pipeline overhead)                 |
| `promptTokens`      | number  | Gemini-reported input token count                                          |
| `outputTokens`      | number  | Gemini-reported completion token count                                     |
| `thoughtsTokens`    | number  | Reasoning tokens (only on models that surface them; 0 for Flash-Lite)      |
| `cachedInputTokens` | number  | Implicit-cache hits (≥ 2048 byte stable prefix)                            |
| `costUsd`           | number  | Cost computed via `apps/api/src/infra/ai/pricing.ts` per-model table       |
| `cacheHit`          | boolean | DynamoDB exact-match cache hit (skipped Gemini entirely)                   |
| `schemaValid`       | boolean | Did the deterministic validator (`validator.ts`) pass?                     |
| `refused`           | boolean | Did the model emit `refused: true` (off-topic guard)                       |
| `degraded`          | boolean | Did the response use a fallback (synthetic ENTSO-E, model cascade, etc.)   |
| `confidenceOverall` | number  | Final score from `domain/confidence.ts` (0–1)                              |
| `fallbackUsed`      | string? | If the cascade fired, which model we dropped from                          |

Example line (collapsed for readability):

```json
{
  "level": "info",
  "time": "2026-05-26T16:00:00.000Z",
  "service": "uk-energy-api",
  "env": "dev",
  "ai": {
    "requestId": "Root=1-6a15c19f-...",
    "modelId": "gemini-3.1-flash-lite",
    "promptVersion": "v1",
    "promptHash": "12f2620869f1b19c",
    "latencyMs": 1837,
    "promptTokens": 557,
    "outputTokens": 376,
    "cachedInputTokens": 0,
    "costUsd": 0.000848,
    "cacheHit": false,
    "schemaValid": true,
    "refused": false,
    "degraded": false,
    "confidenceOverall": 0.78
  },
  "msg": "ai call complete"
}
```

Upstream HTTP retries (`apps/api/src/infra/clients/_lib/retry.ts`), circuit-breaker state transitions, and ENTSO-E synthetic fallbacks emit their own `level:"warn"` lines with `operation`, `attempt`, `nextDelayMs`, `upstream`, and `err` fields.

---

## 2. The public observability endpoint

`GET /api/metrics/ai` aggregates the last 24 hours of telemetry rows into a single JSON payload (see `apps/api/src/application/get-ai-metrics.ts`). The frontend `?debug=1` flag mounts an `AiMetricsPanel` that renders these tiles live.

```json
{
  "last24h": {
    "totalCalls": 247,
    "cacheHitRate": 0.41,
    "avgLatencyMs": 1430,
    "p95LatencyMs": 2810,
    "totalCostUsd": 0.142,
    "avgConfidence": 0.74,
    "schemaValidityRate": 0.987,
    "refusalRate": 0.012,
    "fallbackCount": 2,
    "degradedCount": 18,
    "implicitCacheRate": 0.62,
    "avgInputTokens": 542
  },
  "snapshotAt": "2026-05-26T16:00:00.000Z"
}
```

`implicitCacheRate` is the share of calls that hit Gemini's free implicit cache (system prompt + bookkeeping; ≥ 2048 stable bytes). `degradedCount` captures every response where any upstream source served stale-or-synthetic data.

---

## 3. CloudWatch metric filters to wire in production

Lambda already logs in JSON, so derived CloudWatch Metrics are a single `put-metric-filter` call per signal. Suggested filters (`namespace = UkEnergy/Ai`):

| Metric               | JMESPath filter                                         | Use it for                                       |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `KillSwitchTrips`    | `{ $.msg = "ai call refused (daily budget exceeded)" }` | Cost circuit fires                               |
| `SchemaInvalidCount` | `{ $.ai.schemaValid = false }`                          | Validator drift after prompt or model change     |
| `RefusalCount`       | `{ $.ai.refused = true }`                               | Spike = off-topic users **or** prompt regression |
| `DegradedCount`      | `{ $.ai.degraded = true }`                              | Upstream API or synthetic fallback rate          |
| `ModelFallbackCount` | `{ $.ai.fallbackUsed = * }`                             | RPM 429 frequency on the primary model           |
| `LatencyP95Ms`       | metric value from `$.ai.latencyMs` (statistic `p95`)    | User-visible response speed                      |

Example wiring:

```bash
aws logs put-metric-filter \
  --log-group-name /aws/lambda/uk-energy-api-dev \
  --filter-name SchemaInvalidCount \
  --filter-pattern '{ $.ai.schemaValid = false }' \
  --metric-transformations \
      metricName=SchemaInvalidCount,metricNamespace=UkEnergy/Ai,metricValue=1,defaultValue=0
```

---

## 4. Alarms — four signals worth paging on

In order of operational urgency:

| #   | Alarm                        | Threshold                                            | Why                                                                                                 |
| --- | ---------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | **Kill-switch trip**         | `KillSwitchTrips ≥ 1 / 5 min`                        | We've maxed the $0.50 daily Gemini budget. Symptom of abuse or runaway client.                      |
| 2   | **Schema-validity collapse** | `SchemaInvalidCount / TotalCalls < 0.95 over 15 min` | Model output stopped matching the contract — usually means Gemini behaviour shifted under us.       |
| 3   | **P95 latency**              | `LatencyP95Ms > 3000 for 10 min`                     | Hot-path slowdown; user-visible degradation.                                                        |
| 4   | **Refusal-rate spike**       | `RefusalCount / TotalCalls > 0.20 over 1 h`          | Either a prompt regression (the AI is refusing valid inputs) or an attack — investigate either way. |

All four point at the same SNS topic (`ops-alerts`) with PagerDuty integration in front. The IaC scaffolding for these is a 20-line CloudFormation block — we deliberately did not include it in the demo stack because it requires an SNS topic the reviewer would have to provision separately.

---

## 5. Tracing

X-Ray is **off** by default to avoid the per-trace cost. Each Lambda is annotated for X-Ray subsegments (Gemini call, DynamoDB read, upstream client) so flipping `Tracing: Active` in `infrastructure/template.yaml` enables waterfall traces immediately. Local-dev parity: `pino` request-ID propagation already gives us a poor-man's trace via `requestId` cross-references.

---

## 6. What we deliberately do not monitor

We made an explicit choice **not** to instrument the following — each is a defensible deferral, not an oversight.

- **Inline LLM-as-judge on the hot path.** Would catch ~10% more quality issues but doubles per-request latency and cost. The deterministic L4 validator + offline Promptfoo eval covers the same surface at $0 hot-path cost.
- **PSI / KL-divergence drift detection** on prompt input distribution. Needs a baseline window to compare against — we have ~2 weeks of demo traffic, not enough signal. Once `LOG#` partition has ≥ 30 days of representative traffic, this becomes a weekly batch job, not a real-time alarm.
- **Embedding-similarity cache miss-rate.** Promising once exact-match cache hit-rate drops below 25% — currently at ~40% in local soak tests. Wait for the data to justify the embedding index.
- **Per-prompt-version A/B traffic split metrics.** Single prompt version (`v1`) in production today. The infrastructure to split is one config line (`PROMPT_VERSION` env), but the experiment design + metrics dashboard isn't worth building until we have a v2 to test against.

These items live in `docs/NEXT-STEPS.md` with explicit "next thing to add" priorities.
