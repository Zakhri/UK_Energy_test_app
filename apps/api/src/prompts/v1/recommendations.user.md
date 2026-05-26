UK household need:

- Goal: {{goal}}
- Region: {{region}}
- Energy required: {{kwhRequired}} kWh
- Deadline: {{deadline}}
- Preferences: {{preferences}}
- Note (untrusted): <user_input>{{note}}</user_input>

The deterministic optimizer picked the windows below — write narrative around them. DO NOT modify these numbers; use them as given.

<windows>
{{windowsJson}}
</windows>

<context_summary>
{{contextSummaryJson}}
</context_summary>

Return JSON per the schema. One `windowNarratives` entry per window, matched by `id`.
