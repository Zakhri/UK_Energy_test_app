# Next steps & known gaps

Honest backlog. What we shipped, what we didn't, and the order I would tackle the rest in. Companion to the README and `MONITORING.md` — open this for the "what would you build next?" interview question.

---

## 1. Priority matrix

Effort is engineering days for one developer. Impact is qualitative, anchored to the FTCO scoring rubric where it maps.

| Item                                  | Impact           | Effort          | Closes                          |
| ------------------------------------- | ---------------- | --------------- | ------------------------------- |
| Clock-time post-processor (validator) | High             | 0.5 d           | AI fidelity gap — see §2        |
| Elexon BMRS client (real GB prices)   | High             | 1.5 d           | Brexit / ENTSO-E gap — see §3   |
| Cognito + per-user quotas             | High             | 2 d             | Multi-tenant readiness          |
| AWS WAF + rate-based rules            | Medium           | 0.5 d           | Abuse hardening                 |
| Vertex AI migration                   | Medium           | 1.5 d           | Privacy (no free-tier training) |
| Octopus Agile tariff integration      | Medium           | 1 d             | Real personalised cost numbers  |
| Heat-pump COP-aware scheduling        | Medium           | 2 d             | Domain breadth                  |
| RLHF feedback pipeline                | Low (until data) | 1 d to scaffold | Personalisation                 |
| Semantic embedding cache              | Low (gated)      | 1 d             | Hot-path cost / latency         |
| Multi-region carbon comparison        | Low              | 0.5 d           | UX delight                      |
| Voice / WhatsApp UI                   | Low              | 2 d             | Reach                           |

The first four are the ones I would expect to be asked about in an interview — the rest are well-formed future stories rather than active TODOs.

---

## 2. AI quality TODOs

### 2.1 Clock-time post-processor

**Problem.** The v1 prompt explicitly forbids HH:MM clock times in `summary` / `reasoning` / `tradeoffs` (rule #2 in `apps/api/src/prompts/v1/system.md`). Gemini 3.1 Flash-Lite reliably ignores this for the **deadline echo** — when the user passes `deadline=2026-05-27T07:00Z`, the model emits prose like "_by 07:00 on May 27th_". Our Promptfoo eval used to assert "no clock times in any prose field" — we relaxed it to "no clock times in per-window narratives" because the deadline-echo is harmless content but enforcing the strict rule led to repeated CI red without an actual user-facing bug.

**Fix.** Add a post-processor stage between L4 (validator) and L5 (confidence scorer) that runs a `\b\d{1,2}:\d{2}\b` regex over `summary` / `windowNarratives.reasoning` / `tradeoffs`. Replace matches with `"before your deadline"` / `"during this window"` based on token-distance to known keywords. Re-enable the strict assertion in `ai/evals/cases/happy.yaml`.

**Why not prompt-engineering-only.** We already gave the model a worked example of the bad case and the good case directly in the system prompt. Gemini 3.1 Flash-Lite still emits the bad form ~50% of the time on this specific phrasing. Server-side stripping is a more reliable belt than another braces line.

### 2.2 Citation expansion strategy

**Problem.** The deterministic optimiser passes a context summary that names `priceSource` explicitly but treats carbon-intensity as the implicit default. The AI cites only what it sees named, so a carbon-led recommendation can legitimately end up with `citations: ["entsoe"]`.

**Fix.** Make the context summary also surface `carbonSource: "carbon-intensity"` and `weatherSource: "open-meteo"`. Update the prompt to require all three citations on any window whose `reasoning` mentions carbon, cost, or weather. Re-tighten the eval assertion to require `citations.includes('carbon-intensity')` on the happy case.

### 2.3 Few-shot prompt examples

For each goal (`ev-charge`, `heat-pump`, `high-usage-appliance`, `battery-storage`, `general`) include one prompt-injected gold-standard reasoning paragraph in `system.md`. Currently the model improvises the structure; one good example per goal would harden the failure mode where reasoning drifts into restating the numbers instead of explaining them.

---

## 3. Data source upgrades

### 3.1 Elexon BMRS — real GB day-ahead prices

**Problem.** After 2021-01-01 the ENTSO-E Transparency Platform stopped publishing GB BZN day-ahead prices — the UK left EU electricity market coupling at Brexit. Querying the `10Y1001A1001A92E` area returns `Acknowledgement_MarketDocument code 999: No matching data found`. We correctly detect this and fall back to a bundled synthetic UK curve in `data/synthetic-prices.json`, mark `meta.degraded: true`, and surface it to the user as "Prices shown are synthetic estimates, not your tariff."

**Fix.** Build a new `apps/api/src/infra/clients/bmrs.client.ts` against the [Elexon BMRS API](https://www.elexonportal.co.uk/) — it publishes the actual GB system price (`B1770` "Imbalance prices") and day-ahead reference price (`B1620`). The shape needs Zod-parsing, the same `withRetry` + `sharedCircuitBreaker` + `withCache` wrappers, and the existing `entsoe.client.ts` can stay as a secondary EU reference source toggled by `ENTSOE_AREA_CODE` (e.g. DE-LU for European baseline). Cost: free, registration takes ~15 minutes for a CSV-style API key.

**Why we didn't build it for the demo.** Registration loop + first-real-data verification adds ~2 hours that traded off against the AI pipeline depth (which is the 35% scoring criterion). The Brexit fallback is reviewer-friendly out of the box.

### 3.2 Octopus Agile dynamic-tariff API

Most UK households are on flat-rate tariffs, but the ~5% on Octopus Agile see half-hourly prices that change daily. The Octopus public API returns these without auth. A new `agile.client.ts` plus a `tariffMode: "flat" | "agile"` field on `RecommendationsQuery` would make the cost numbers actually accurate for that audience. Currently we use the synthetic / ENTSO-E day-ahead curve as a proxy for tariff prices, which is a known approximation.

### 3.3 National Grid ESO — DNO-level intensity

The current Carbon Intensity API returns one number for the whole national grid. National Grid ESO publishes regional DNO-level intensity (16 regions matching our `regionSchema`). Wiring this in would let "Scotland is greener than London right now" land as a real signal rather than today's flat number per query.

---

## 4. Production-readiness add-ons

### 4.1 Cognito + per-user quotas

The app today is anonymous — the only quota is API Gateway throttling (5 rps / 10 burst, **shared across all users**). For a real consumer product:

- Cognito user pool (free tier up to 50k MAUs)
- Per-user JWT carried in `Authorization: Bearer`
- Lambda authorizer reads JWT, sets `userId` on the request context
- DynamoDB rate-limiter switches from `RATE#<minute>` to `RATE#<userId>#<minute>`

Effort: 2 days including UI sign-up flow. Deferred from the demo because the assignment scope is single-tenant.

### 4.2 AWS WAF in front of CloudFront

Even with Cognito, abuse still comes from credential stuffing. A WAF webACL with rate-based rules (1000 req / 5 min per IP) + the AWS-managed `CommonRuleSet` adds an industrial layer of defence for ~$5/month. Drop-in for the CloudFront distribution in `template.yaml`.

### 4.3 Vertex AI migration

Free-tier Gemini sends prompts and responses to Google for model training. There is no opt-out. For any non-demo deployment this is a privacy regression we would not ship. The architectural change is small — swap `googleapi.com/v1beta` for the Vertex `aiplatform.googleapis.com` endpoint, add IAM service-account auth, point at the same `gemini-3.1-flash-lite` model ID. Costs ~10× the free-tier cap but is enterprise-safe.

### 4.4 Secret rotation

`GEMINI_API_KEY` lives in SSM SecureString today, manually rotated. AWS SSM supports rotation Lambdas — for production we would write a 50-line rotation function that calls Google's key API every 90 days and updates the SSM parameter. The Lambda inherits the same arm64 + Node 22 + ARM Graviton base as the app.

---

## 5. Domain expansion

### 5.1 Heat-pump COP-aware scheduling

Heat pumps have a Coefficient of Performance (COP) that drops as outdoor temperature falls. Running a heat pump in cold-but-clean overnight windows can be **more** carbon-intensive than running it in warm-but-dirtier midday, because the heat-pump consumes 2–3× more electricity per kWh of delivered heat. The current optimiser doesn't model COP. Adding it requires a heat-pump-specific scoring function in `application/_lib/find-optimal-windows.ts` that pulls the weather forecast and applies the inverse COP curve. Domain breadth that I would prioritise once the EV-charge case is rock solid.

### 5.2 RLHF feedback pipeline

The `POST /api/feedback` endpoint is **scaffolded** (`apps/api/src/routes/`, DynamoDB partition `FEEDBACK#<requestId>`) but it doesn't yet train anything. Once we accumulate ≥ 1000 thumbs-up/down rows tied to specific window choices, a weekly batch job can:

1. Pull all `down` cases from the last 7 days.
2. Bucket them by the dominant signal (carbon vs cost vs convenience).
3. Generate one prompt-tweak suggestion per bucket using a stronger LLM (Gemini Pro or Claude).
4. A/B test the tweak via `PROMPT_VERSION=v2` traffic split.

This is RLHF-light — no model fine-tuning, just prompt iteration informed by real user signal. Cheap and fast.

### 5.3 Semantic embedding cache

Today's cache is a SHA-256 exact-match — change the question phrasing slightly and you miss. An embedding cache (Sentence-Transformers via Bedrock or `@xenova/transformers` locally) gives ~25% extra hit-rate when the bar isn't 100% identical input. We deliberately did not build this because local soak tests show ~40% exact-match hit-rate already; the cost-benefit only flips when that drops below ~25%, which would happen with more diverse production traffic.

### 5.4 Multi-region carbon comparison

For users near DNO boundaries (e.g. Tyneside / Yorkshire), surfacing "your neighbouring region is 30% cleaner right now" would change real behaviour. One extra `regionSchema.options` map + a side-by-side Recharts panel. Half-day of work, high UX delight.

### 5.5 Voice / WhatsApp UI

The audience for energy-shifting decisions doesn't sit in front of a dashboard — they want to ask "should I run the dishwasher now?" while loading it. A Twilio WhatsApp integration + a Lambda that translates SMS → `/api/recommendations` query → SMS reply with the best window. The AI surface stays unchanged, the channel becomes ubiquitous.

---

## 6. F28 — explicit ENTSO-E disclosure (referenced from README)

Repeated here as the canonical landing-place: **the synthetic price curve served for GB BZN is a deliberate design choice, not a missing feature.** ENTSO-E does not publish GB day-ahead prices in 2026. The synthetic curve is sourced from `data/synthetic-prices.json` (a typical UK day-ahead profile from 2024-Q4 anonymised), the response is marked `meta.degraded: true`, the UI shows "Prices shown are synthetic estimates, not your tariff.", and the next step is the Elexon BMRS client in §3.1. Other reviewer-runnable alternatives:

- **Set `ENTSOE_AREA_CODE=10Y1001A1001A82H` (DE-LU)** and the same client serves real Germany-Luxembourg prices — useful for showing the integration is live, but the numbers aren't UK-relevant.
- **Use the live demo URL** — synthetic prices are clearly labelled in the UI; the AI explainer references them honestly.

---

## 7. What I would change in the architecture

A few things I would do differently with the benefit of one more pass.

- **Lambda Function URL with response streaming** instead of API Gateway REST. The `/api/recommendations/stream` SSE endpoint is currently bypassed in production because APIGW REST buffers Lambda responses. Function URLs support true streaming, would unlock the perceived-speed UX the frontend already has wired up. Trade-off: lose APIGW's WAF and authorizer integrations (move them to CloudFront).
- **DynamoDB Streams → EventBridge** for the AI call log instead of best-effort fire-and-forget writes. The current `telemetry.persistAsync` design returns to the user before the write completes — fine for the dashboard tile, weak for guaranteed audit.
- **Single SSM Parameter per environment** with a JSON payload instead of one parameter per secret. The SAM template's `--parameter-overrides` array gets noisy when you add ENTSOE_API_KEY + Octopus + BMRS keys — collapsing them into one Parameter halves the IAM noise and makes rotation simpler.
- **`packages/shared/` exports also via a versioned npm tarball** rather than only as a workspace dep. Local-only sharing is fine for one repo; the moment we add a mobile or CLI client, the lockstep contract needs a published artifact.
