UK household — trend insight for region {{region}}.

The backend already computed today's grid average vs the past 7 days deterministically. DO NOT modify these numbers; use them as facts:

<trend>
{{trendsJson}}
</trend>

Weather context for today (helps explain _why_ the carbon intensity is what it is — low wind → more gas in the mix; high cloud → less solar; etc.):

<weather>
{{weatherJson}}
</weather>

<context_summary>
{{contextSummaryJson}}
</context_summary>

Return JSON per the schema:

- `headline` — one short line (≤120 chars) capturing the verdict in natural language (e.g. "Today's grid is dirtier than the past week — wind output is down.").
- `explanation` — 2–3 sentences (≤500 chars) tying the delta to the weather context. Speak to a household, not an engineer.
- `drivers` — 2–4 bullet points (each ≤180 chars), each one a specific cause from the data (low/high wind, cloud cover, demand pattern, price spike, etc.). Use the actual numbers from `<trend>` and `<weather>` where helpful.
- `caveats` — surface honestly when sample size is small (`todaySampleSize` or `weekSampleSize` under 24), when the delta is borderline (`verdict: similar`), or when prices are synthetic.
- `citations` — include every source you relied on.

Same hard rules as the system prompt: refuse off-topic, NO HH:MM clock times in `headline` / `explanation` / `drivers`, plain UK English.
