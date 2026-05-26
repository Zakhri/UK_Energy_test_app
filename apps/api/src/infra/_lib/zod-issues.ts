import type { ZodError } from 'zod';

export interface SafeIssueSummary {
  readonly invalidFields: readonly string[];
  readonly count: number;
}

export function safeZodIssues(error: ZodError): SafeIssueSummary {
  const fieldNames = new Set<string>();
  for (const issue of error.issues) {
    if (issue.path.length === 0) {
      fieldNames.add('_root');
      continue;
    }
    fieldNames.add(String(issue.path[0]));
  }
  return {
    invalidFields: Array.from(fieldNames).sort(),
    count: error.issues.length,
  };
}
