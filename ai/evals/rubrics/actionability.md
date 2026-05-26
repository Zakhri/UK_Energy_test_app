# Actionability rubric (LLM-as-judge)

Score the response on **actionability** — whether the user can act on it
without further clarification.

## Scoring (1–5)

- **5**: Names a specific time window (start + end ISO timestamp) and
  expected impact (gCO₂/kWh or £/kWh). User can charge immediately.
- **4**: Specific window but missing one expected-impact number.
- **3**: Vague window ("late tonight", "overnight") with expected impact.
- **2**: Vague window, no impact numbers.
- **1**: No window at all — just "it depends" or "varies".

## Output format

JSON only:

```json
{"actionability": N, "reasoning": "one-sentence justification"}
```

A score of ≥ 4 is the pass threshold.
