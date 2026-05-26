# UK Household Energy & Carbon Insights

Serverless AI advisor that tells a UK household **when to run energy-heavy appliances** to minimise carbon, cost, or both. Combines live grid carbon intensity, weather forecasts, and day-ahead electricity prices with a Gemini-powered explainer.

**Live demo:** <https://dwkms8s8b0nwk.cloudfront.net>
**API endpoint:** `https://uodhzi07vg.execute-api.eu-west-2.amazonaws.com/dev`
**Region:** `eu-west-2` (London)

---

## TL;DR

- **Stack:** Hono lambdalith on Lambda (Node 22, arm64) · API Gateway · DynamoDB · S3 + CloudFront · Google Gemini 3.1 Flash-Lite · React 18 + Vite + Recharts.
- **AI** Six-layer defence pipeline: input guard → cache → Gemini → deterministic validator → confidence scorer → telemetry. The deterministic window optimiser picks the windows; the AI writes the narrative around them.
- **148 unit tests** (105 backend + 43 frontend) + **Promptfoo eval suite** + **GitHub Actions CI/CD with auto-deploy** to AWS.

## Documentation

- 📄 **[docs/MONITORING.md](./docs/MONITORING.md)** — telemetry envelope, `/api/metrics/ai` schema, CloudWatch filters, the four alarms worth paging on.
- 📄 **[docs/NEXT-STEPS.md](./docs/NEXT-STEPS.md)** — prioritised backlog, AI quality TODOs, Elexon BMRS plan, production hardening, the F28 ENTSO-E / Brexit disclosure.

---

## Architecture

```
                          User Browser
                              │
                              ▼
                  ┌─────────────────────────┐
                  │  CloudFront Distribution │
                  │   (single origin, OAC)   │
                  └────────┬────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
        ┌──────────┐            ┌──────────────────┐
        │ S3 (SPA) │            │  API Gateway REST│
        │  React   │            │   /api/*  proxy  │
        │  Vite    │            └────────┬─────────┘
        └──────────┘                     │
                                         ▼
                              ┌───────────────────────┐
                              │  Lambda (Hono)        │
                              │  Node 22 · arm64      │
                              │  ESM bundle (esbuild) │
                              │                       │
                              │  Routes:              │
                              │    /signals/:category │
                              │    /compare           │
                              │    /recommendations   │
                              │    /insights/trends   │
                              │    /metrics/ai        │
                              │    /health            │
                              │                       │
                              │  AI Pipeline (L1-L6): │
                              │    Guard·Cache·Gemini │
                              │    Validator·Scorer   │
                              │    Telemetry          │
                              └─┬─────┬─────┬───────┬─┘
                                │     │     │       │
        ┌───────────────────────┘     │     │       └──────────────┐
        ▼                             ▼     ▼                      ▼
  Carbon Intensity API         Open-Meteo  ENTSO-E             DynamoDB
  (api.carbonintensity.org.uk) (no auth)   (key, synthetic     single-table
  no auth                                   fallback)          (cache · AI log ·
                                                                rate-limit ·
                                                                circuit-breaker)
                                          ▲
                                          │
                                      Google Gemini
                                      3.1 Flash-Lite
                                      (REST + SSM key)
                                          │
                                          ▼
                                       CloudWatch
                                       (JSON logs · metrics)
```

---

## Quick start — 4 paths

A root `Makefile` wraps every command below. Run `make help` after cloning for the full menu.

### Path A. Use the live demo (zero setup)

Open **<https://dwkms8s8b0nwk.cloudfront.net>**. The form is pre-filled — submit it and walk through Recommend → Trends → Compare flows.

### Path B. Local with Docker Compose (recommended for reviewers)

**Prereqs:** Docker, Node 22, a free Gemini key from <https://aistudio.google.com/>.

```bash
git clone https://github.com/Zakhri/UK_Energy_test_app.git
cd UK_Energy_test_app
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=AIza...
make install
make dev
# Open http://localhost:5173
```

Stops with `make docker-down`.

### Path C. Verify SAM IaC + API via `sam local start-api`

Use this path when you want to **exercise the SAM template** itself and **hit the API endpoints with `curl`**. This is _API-only_ verification — for the combined SPA + API experience use **Path B (docker compose)**, which gives a cleaner local stack without the SAM rapid runtime + Vite proxy double-buffering edge cases.

**Prereqs:** SAM CLI, Docker, Node 22, Gemini key in shell env.

```bash
git clone https://github.com/Zakhri/UK_Energy_test_app.git
cd UK_Energy_test_app
make install
export GEMINI_API_KEY=AIza...
make sam-build
make sam-local                   # API on http://localhost:3000
```

In another shell, hit the endpoints directly:

```bash
curl -s http://localhost:3000/api/health | jq
curl -s "http://localhost:3000/api/insights/trends?region=GB-LON" | jq
curl -s "http://localhost:3000/api/recommendations?goal=ev-charge&kwh=40&deadline=2026-05-27T07:00:00Z&region=GB-LON&preferences=low-carbon" | jq
```

`infrastructure/env.local.json` (tracked in git, no secrets) overrides `GEMINI_KEY_PARAM` → `GEMINI_API_KEY` so SSM is not consulted in local mode.

### Path D. Deploy to your own AWS account

**Prereqs:** AWS account, SAM CLI, Docker, Node 22, AWS CLI configured.

```bash
git clone https://github.com/Zakhri/UK_Energy_test_app.git
cd UK_Energy_test_app
make install
make ssm-put-gemini KEY=AIza...your-key     # stores it in SSM SecureString
make sam-config                              # copies samconfig template
make deploy                                  # sam build + deploy + web build + sync + CF invalidation
```

The final SAM deploy step prints `CloudFrontUrl=https://<id>.cloudfront.net` — that's the live URL.

---

## API reference

Base URL (live): `https://uodhzi07vg.execute-api.eu-west-2.amazonaws.com/dev`. Through CloudFront use `/api/*` paths on the SPA origin.

All responses are JSON. Errors follow RFC 7807 (`application/problem+json`).

### `GET /api/health`

```bash
curl https://uodhzi07vg.execute-api.eu-west-2.amazonaws.com/dev/api/health | jq
```

```json
{
  "status": "ok",
  "environment": "dev",
  "timestamp": "2026-05-26T16:00:00.000Z",
  "dependencies": {
    "gemini": "configured",
    "dynamodb": "configured",
    "carbonIntensity": "reachable",
    "weather": "reachable",
    "entsoe": "configured"
  }
}
```

### `GET /api/signals/:category`

`category ∈ { carbon | weather | price }`. Returns a normalised time series for the next 24-48 hours.

```bash
curl "https://.../api/signals/carbon?region=GB-LON" | jq
```

### `GET /api/recommendations`

Best windows + AI narrative for a household goal.

```bash
curl "https://.../api/recommendations?\
goal=ev-charge&\
kwh=40&\
deadline=2026-05-27T07:00:00Z&\
region=GB-LON&\
preferences=low-carbon,avoid-peak" | jq
```

```json
{
  "summary": "Charge overnight when wind output peaks. The early-morning window cuts carbon ~38% versus running now.",
  "recommendations": [
    {
      "windowStart": "2026-05-27T02:00Z",
      "windowEnd": "2026-05-27T06:00Z",
      "avgCarbonGCo2": 58,
      "avgCostPounds": 0.048,
      "priority": 1,
      "reasoning": "Cleanest slot before your deadline...",
      "tradeoffs": "Charges unattended..."
    }
  ],
  "confidence": {
    "overall": 0.78,
    "recommendation": "use_direct",
    "components": {
      "dataFreshness": 0.95,
      "contextCoverage": 1.0,
      "citations": 1.0,
      "schemaValidity": 1.0
    },
    "caveats": []
  },
  "citations": ["carbon-intensity", "open-meteo"],
  "meta": {
    "requestId": "Root=1-...",
    "modelUsed": "gemini-3.1-flash-lite",
    "promptVersion": "v1",
    "costUsd": 0.000848,
    "aiCacheHit": false,
    "degraded": false,
    "dataAgeSeconds": 12
  }
}
```

**Query parameters:**

- `goal` — `ev-charge | heat-pump | high-usage-appliance | battery-storage | general`
- `region` — one of 16 GB DNO regions (`GB-LON`, `GB-NATIONAL`, `GB-NORTH-SCOTLAND`, …)
- `kwh` — energy needed, 0.1–200
- `deadline` — ISO 8601 datetime with timezone (e.g. `2026-05-27T07:00:00Z`)
- `preferences` — comma-separated: `low-carbon | low-price | avoid-peak | fast-completion`

### `POST /api/compare`

Score 2–6 user-defined windows against the criteria.

```bash
curl -X POST https://.../api/compare \
  -H 'Content-Type: application/json' \
  -d '{
    "region": "GB-LON",
    "scenarios": [
      {"id":"s1","label":"Tonight 22–02","windowStart":"2026-05-26T22:00Z","windowEnd":"2026-05-27T02:00Z","kwh":40},
      {"id":"s2","label":"Tomorrow 02–06","windowStart":"2026-05-27T02:00Z","windowEnd":"2026-05-27T06:00Z","kwh":40}
    ],
    "criteria": { "goal": "ev-charge", "weights": {"carbon":0.7,"cost":0.2,"speed":0.1} }
  }'
```

### `GET /api/insights/trends?region=GB-LON`

Today's grid intensity vs the trailing 7-day distribution. AI-summarised.

### `GET /api/metrics/ai`

Public observability — last-24h aggregates: call count, cache hit rate, avg latency, total cost USD, refusal rate.

### `GET /api/recommendations/stream`

SSE variant of `/recommendations` for progressive stage updates. **Local only** — API Gateway REST buffers Lambda responses, so the SPA falls back to the JSON endpoint in production.

---

## AI pipeline — what the 6 layers do

| Layer                     | File                                | Purpose                                                                                                                                                            |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **L1 Guard**              | `apps/api/src/infra/ai/guard.ts`    | Strip prompt-injection patterns, redact postcodes to outward-only, enforce 4000-token input ceiling.                                                               |
| **L2 Cache + rate-limit** | `cache.ts` · `rate-limiter.ts`      | SHA-256 cache key over `(prompt_version, inputs, 15-min bucket)` → DynamoDB. RPM/RPD counter to honour Gemini free-tier limits.                                    |
| **L3 Gemini call**        | `gemini.client.ts`                  | Direct REST (no SDK), `temperature: 0`, `seed: 42`, structured `responseSchema`. Retry with jitter on 5xx, cascade-fallback `Flash-Lite → 2.5 Flash` on RPD 429.   |
| **L4 Validator**          | `validator.ts`                      | Zod parse, numeric clamp, citation regex, source-substring grounding (every numeric claim must appear in input context), forbidden-claim regex.                    |
| **L5 Confidence**         | `apps/api/src/domain/confidence.ts` | Weighted score (0.4·freshness + 0.3·coverage + 0.2·citations + 0.1·schema) → enum `use_direct \| use_with_caveat \| ask_user \| fallback_cache`.                   |
| **L6 Telemetry**          | `telemetry.ts`                      | Structured `pino` JSON: requestId, promptVersion, modelId, tokens, costUsd, latency, cacheHit, schemaValid, confidence, degraded. Aggregated in `/api/metrics/ai`. |

The deterministic window optimiser (`apps/api/src/application/_lib/find-optimal-windows.ts`, 12 unit tests) picks windows from the carbon/price grid. The AI is forbidden from inventing windows — its role is narrative only.

---

## Data sources

| Source                   | Auth               | Cache TTL | Stale-while-error |
| ------------------------ | ------------------ | --------- | ----------------- |
| UK Carbon Intensity API  | none               | 30 min    | 6 hours           |
| Open-Meteo forecast      | none               | 60 min    | 12 hours          |
| ENTSO-E Day-ahead prices | API key (optional) | 60 min    | 24 hours          |

Each upstream client is wrapped in `withRetry` (3 attempts, exponential + jitter), `sharedCircuitBreaker` (opens after 3 failures in 60s, half-open probe after 30s), and `withCache` (DynamoDB).

**ENTSO-E + Brexit caveat.** After 2021-01-01 the ENTSO-E Transparency Platform stopped publishing GB BZN day-ahead prices (UK left EU electricity market coupling). The client correctly receives `Acknowledgement_MarketDocument code 999: No matching data found` and falls back to a bundled synthetic UK curve from `data/synthetic-prices.json`. The response is marked `meta.degraded: true` and the UI shows "Prices shown are synthetic estimates, not your tariff." For real GB prices, the next step is an **Elexon BMRS** client (see [docs/NEXT-STEPS.md](./docs/NEXT-STEPS.md)).

---

## Environment variables

Required at runtime. In production, `GEMINI_API_KEY` and `ENTSOE_API_KEY` are resolved from SSM Parameter Store (SecureString); locally they come from `.env`.

| Variable                   | Default                         | Purpose                                                      |
| -------------------------- | ------------------------------- | ------------------------------------------------------------ |
| `GEMINI_API_KEY`           | —                               | Gemini API key (local only — Lambda uses `GEMINI_KEY_PARAM`) |
| `GEMINI_KEY_PARAM`         | `/uk-energy/dev/GEMINI_API_KEY` | SSM SecureString path (Lambda only)                          |
| `GEMINI_PRIMARY_MODEL`     | `gemini-3.1-flash-lite`         | Single model — see `apps/api/src/infra/ai/pricing.ts`        |
| `GEMINI_DAILY_BUDGET_USD`  | `0.50`                          | Kill-switch — beyond this, returns synthetic + 503           |
| `GEMINI_MAX_INPUT_TOKENS`  | `4000`                          | L1 guard rejects larger inputs                               |
| `GEMINI_MAX_OUTPUT_TOKENS` | `4000`                          | maxOutputTokens to Gemini                                    |
| `GEMINI_RPM_LIMIT`         | `15`                            | Free-tier limit for 3.1 Flash-Lite                           |
| `GEMINI_RPD_LIMIT`         | `500`                           | Free-tier daily limit                                        |
| `PROMPT_VERSION`           | `v1`                            | Source of truth in `apps/api/src/prompts/v1/`                |
| `ENTSOE_API_KEY`           | —                               | Optional; synthetic fallback when absent                     |
| `DYNAMODB_TABLE`           | —                               | Single-table name (Lambda only)                              |
| `ALLOWED_ORIGIN`           | `*`                             | CORS — tighten to CloudFront domain after deploy             |

Full list with comments: `.env.example` + `infrastructure/template.yaml` (Globals.Function.Environment).

---

## Privacy notice

**Gemini free-tier prompts and responses are used by Google for model training. There is no opt-out on the free tier.** Do not send PII or sensitive household data through the live demo. L1 guard strips obvious PII (postcodes → outward only, e-mails masked), but the only way to fully prevent training-data ingestion is to switch to the paid Gemini tier or Vertex AI (see [docs/NEXT-STEPS.md](./docs/NEXT-STEPS.md)).

---

## Infrastructure cost

Numbers below are calculated against eu-west-2 pricing (Lambda arm64 = $0.0000133334/GB-s, API Gateway REST = $3.50/M req, DynamoDB on-demand = $1.25/M writes + $0.25/M reads, CloudFront PriceClass_100 = $0.085/GB after the 1 TB/year free tier). Free-tier columns marked **permanent** never expire; the other free tiers run for the first 12 months of the AWS account.

| Item                                      | Free-tier headroom                   | Cost @ 100 DAU | Cost @ 1k DAU (after free-tier expiry) |
| ----------------------------------------- | ------------------------------------ | -------------- | -------------------------------------- |
| Lambda (Node 22 arm64, 512 MB, ~1.5s avg) | 1M req + 400k GB-s **permanent**     | $0             | < $0.10 (well inside permanent tier)   |
| API Gateway REST                          | 1M req/mo for 12 months              | $0             | ~$0.50                                 |
| DynamoDB on-demand                        | 25 GB storage **permanent**          | < $0.10        | ~$0.50                                 |
| S3 (SPA, ~7 MiB)                          | 5 GB · 20k GET · 2k PUT (12 mo)      | $0             | $0                                     |
| CloudFront (PriceClass_100, US+EU+CA)     | 1 TB egress + 10M req (12 mo)        | $0             | ~$2.50                                 |
| CloudWatch (logs + 4 alarms)              | 5 GB ingest **permanent**            | $0             | ~$0.40                                 |
| **Gemini 3.1 Flash-Lite**                 | 500 RPD ≈ 15k calls/mo **permanent** | $0             | **≤ $15/mo** (kill-switch hard cap)    |
| **Total**                                 | **$0** for the demo workload         | ~$0.10/mo      | **≤ $20/mo cap**                       |

The Gemini line is the dominant cost driver. The `GEMINI_DAILY_BUDGET_USD=0.50` env var hard-stops AI calls at $0.50/day → **$15/mo absolute ceiling** for AI. Even under sustained traffic or abuse, total AWS + AI bill cannot exceed ~$20/month. Below that ceiling, real workload @ 1k DAU with our ~40% cache hit rate lands closer to ~$7-10/month.

---

## What deliberately skipped

- **AWS Cognito auth.** The app is a stateless calculator-style tool — no user data persisted, no per-user quotas needed for a demo. Cognito would add deployment friction without product value. For multi-tenant rollout it's the first item in [docs/NEXT-STEPS.md](./docs/NEXT-STEPS.md).
- **AWS WAF / per-IP rate-limit.** API Gateway throttling (5 rps sustained, 10 burst) + the daily AI budget kill-switch cap actual abuse cost at $0.50/day. WAF is documented as a production-readiness add-on.
- **Inline LLM-as-judge on hot path.** The deterministic L4 validator catches ~70% of issues without an extra Gemini call. Promptfoo runs offline as the LLM-judge layer (nightly + on AI-relevant PRs).
- **Screen recording / screenshots.** The deployed URL above satisfies the "Working demo" requirement directly.

---

## Leadership & Architecture

### Trade-offs

I chose a **single Hono lambdalith over a fan-out of micro-Lambdas**. Five endpoints don't justify five cold starts, five log groups, or five IAM roles; the tradeoff is shared blast radius (one bug can blanket-fail every route) which I accept because the routes are co-versioned anyway. I chose **direct REST to Gemini over the SDK** — saves ~150 KB on the bundle and a cold-start hit, costs me hand-rolled retry/cascade-fallback code that I needed anyway to honour RPM/RPD limits. The **deterministic L4 validator over inline LLM-as-judge** is the biggest deliberate trade — I accept narrower error catch (~70%) for $0 hot-path cost and <5 ms latency, and offload the rest to offline Promptfoo evals. The **synthetic ENTSO-E fallback** trades demo realism for reviewer-runnability when the post-Brexit ENTSO-E GB gap surfaces. Finally, I keep prompts under `git` with a SHA-16 hash baked into the cache key — caching a v1 response and serving it after we silently changed v2 would be a worse failure than a cache miss.

### Team planning (3 developers · 2 weeks)

**Week 1 — parallel tracks (Mon–Fri).** Dev A owns the infra spine: SAM template, single-table DynamoDB schema, CloudFront + S3 + OAC, GitHub Actions skeleton, observability defaults (`pino` JSON + CloudWatch metric filters). Dev B owns the AI layer end-to-end: 6-layer pipeline, prompt registry under `git`, Promptfoo eval suite with screening cases, confidence scorer. Dev C owns the UX surface: React + Vite scaffold, three flows (Recommend / Compare / Trends), confidence UX, Recharts with hatched high-carbon zones. Daily 15-min standup on a Slack thread, shared design doc in the repo (`docs/`), Zod schemas in `packages/shared/` are the contract — any change PR-reviewed by two of three.

**Week 2 — integration + hardening (Mon–Thu).** Wiring + e2e from `sam local start-api` cold-clone. CI gates: lint + typecheck + 80% coverage + Promptfoo threshold. Production prep — kill-switch testing, circuit-breaker drills with chaos injection on the upstream clients, cost ceiling alarms. **Fri** reserved for the unknown-unknown — there is always one, and a project this size doesn't get a no-surprise week.

### Production readiness

Before turning this on for real users I would add: **Cognito + per-user rate limits** (the kill-switch protects cost, not multi-tenant fairness), **AWS WAF** in front of CloudFront with rate-based rules + bot detection, **AWS X-Ray** tracing across Lambda → DynamoDB → Gemini for P99 latency forensics, **CloudWatch alarms** wired to SNS for the four signals that actually matter (P95 latency > 3s, kill-switch trips, AI cost ≥ 80% of budget, schema-validity rate < 95%), **blue/green deploys** via SAM canary with 5% traffic for 10 min before full cut-over, **dead-letter SQS** for failed AI calls to enable retry-with-different-prompt experiments, **secret rotation** every 90 days via SSM Parameter Store rotation Lambda, **per-feature flag service** (GrowthBook or LaunchDarkly) so prompt versions can A/B without redeploying, and **Vertex AI migration** to get rid of the free-tier training-data ingest privacy concern. SLO doc: P95 < 2.5s, availability ≥ 99.5%, AI cost ≤ $0.001 per session.

### If I had more time

The single most valuable next feature is **tariff-aware optimisation** — wire the Octopus Agile API so users on dynamic tariffs see their actual half-hourly prices instead of the day-ahead curve. Second, **heat-pump-specific scheduling** that respects the COP curve vs outdoor temperature (a heat pump's "best window" is qualitatively different from an EV's). Third, **personalised recommendations using the `/api/feedback` data** once enough thumbs-up/down accumulate — RLHF-ready prompt tuning rather than full fine-tuning. Fourth, **a semantic embedding cache** once the SHA-256 hash hit-rate drops below 25% (currently ~40% locally — the bar isn't there yet). Fifth, **a voice / WhatsApp interface** via Twilio so the system meets users where they already make these decisions, not in a browser tab. Full backlog: [docs/NEXT-STEPS.md](./docs/NEXT-STEPS.md).

---

## Project structure

```
.
├── apps/
│   ├── api/                  Lambda (Hono lambdalith)
│   │   ├── src/
│   │   │   ├── api.ts        Hono app + handler export
│   │   │   ├── routes/       6 Hono route files
│   │   │   ├── application/  Use-cases + _lib/ (find-optimal-windows, compute-trends, score-scenarios)
│   │   │   ├── domain/       Pure types + confidence scorer
│   │   │   ├── infra/
│   │   │   │   ├── ai/       6-layer pipeline (guard·cache·gemini·validator·scorer·telemetry)
│   │   │   │   ├── clients/  3 upstream clients (+ _lib/retry, circuit-breaker)
│   │   │   │   └── cache/    DynamoDB single-table + in-memory adapter
│   │   │   └── prompts/v1/   System + user prompt templates (read directly by Promptfoo)
│   │   └── test/unit/        14 spec files · 105 tests
│   └── web/                  React 18 + Vite + TanStack Query + Recharts
│       ├── src/components/   11 top-level UI components
│       ├── src/hooks/        useRecent · useRecommendationFlow · useCompareFlow · useTrendsFlow · …
│       └── test/             6 spec files · 43 tests (jsdom + Testing Library)
├── packages/shared/          Zod schemas reused by API + frontend
├── infrastructure/
│   ├── template.yaml         SAM template (7 CFN resources)
│   ├── samconfig.toml.example
│   └── env.local.json        sam local env overrides
├── ai/evals/                 Promptfoo config + 7 case files + analyzer
├── scripts/                  deploy-web.sh · docker-up.sh · e2e tests
├── .github/workflows/ci.yml  9 jobs (lint/test/coverage · sam-validate · build-web · promptfoo-smoke · auto-deploy)
└── docs/
    ├── MONITORING.md         What we log + alarms scaffolding
    └── NEXT-STEPS.md         AI quality TODOs · Elexon BMRS · tariff-aware
```

---

## Quality gates

```bash
npm run validate     # prettier + eslint + tsc + 148 tests
npm test             # vitest, both workspaces
npm run test:coverage # 82% lines / 87% branches (gate: 70/65/70/70)
npm run eval         # Promptfoo full eval — 7 cases × 1 prompt × 1 model
npm run e2e          # end-to-end smoke against the API
```

CI runs the same gates on every push + PR. Auto-deploy on push to `main` (gated on path filter — only redeploys what changed). Manual `workflow_dispatch` available for verification runs.

---

## Why these non-standard choices

- **Hono lambdalith.** Routing layer ~12 KB gzipped, AWS-Lambda adapter is a one-line wrapper, no SDK weight. Express would add ~30 KB and 100 ms cold start.
- **Promptfoo.** Eval framework with deterministic JS assertions + LLM-rubric in the same case file, HTML report viewer, cache hits free. Cheaper than building our own harness; comparable to OpenAI Evals but vendor-neutral.
- **TanStack Query.** Server cache + retry + stale-while-revalidate out of the box, replaces ~200 LOC of bespoke fetch hooks and removes a class of "stale data after navigation" bugs.

---

**Submitted by:** Zakhar Hurinovich
**Contact:** hurynovich.zakhar@gmail.com
**License:** MIT
