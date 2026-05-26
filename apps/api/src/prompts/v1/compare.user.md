UK household comparing scheduling options.

- Goal: {{goal}}
- Region: {{region}}
- Criteria weights: carbon={{weights.carbon}}, cost={{weights.cost}}, speed={{weights.speed}}

The backend has ALREADY scored and ranked the scenarios below. DO NOT modify the scores or numbers. Write narrative around them.

<ranked_scenarios>
{{rankedJson}}
</ranked_scenarios>

<context_summary>
{{contextSummaryJson}}
</context_summary>

Return JSON per the schema: one `scenarioRationales` entry per scenario (matched by `scenarioId`, ≤150 chars rationale each), plus one overall `reasoning` paragraph (≤2000 chars). Same citation + refusal rules as the system prompt.
