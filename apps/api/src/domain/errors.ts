export type ProblemType =
  | 'about:blank'
  | 'https://uk-energy.dev/problems/validation'
  | 'https://uk-energy.dev/problems/upstream-unavailable'
  | 'https://uk-energy.dev/problems/rate-limited'
  | 'https://uk-energy.dev/problems/ai-refused'
  | 'https://uk-energy.dev/problems/budget-exhausted'
  | 'https://uk-energy.dev/problems/internal';

export interface ProblemDetails {
  type: ProblemType;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  [extension: string]: unknown;
}

export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly problemType: ProblemType;
  abstract readonly title: string;

  constructor(
    message: string,
    public readonly extensions: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toProblem(requestId?: string): ProblemDetails {
    return {
      type: this.problemType,
      title: this.title,
      status: this.status,
      detail: this.message,
      ...(requestId ? { instance: requestId } : {}),
      ...this.extensions,
    };
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
  readonly problemType = 'https://uk-energy.dev/problems/validation' as const;
  readonly title = 'Validation failed';
}

export class UpstreamUnavailableError extends AppError {
  readonly status = 503;
  readonly problemType = 'https://uk-energy.dev/problems/upstream-unavailable' as const;
  readonly title = 'Upstream data source unavailable';
}

export class RateLimitedError extends AppError {
  readonly status = 429;
  readonly problemType = 'https://uk-energy.dev/problems/rate-limited' as const;
  readonly title = 'Rate limit exceeded';
}

export class AiRefusedError extends AppError {
  readonly status = 422;
  readonly problemType = 'https://uk-energy.dev/problems/ai-refused' as const;
  readonly title = 'AI refused to answer';
}

export class BudgetExhaustedError extends AppError {
  readonly status = 503;
  readonly problemType = 'https://uk-energy.dev/problems/budget-exhausted' as const;
  readonly title = 'AI budget exhausted for today';
}

export class InternalError extends AppError {
  readonly status = 500;
  readonly problemType = 'https://uk-energy.dev/problems/internal' as const;
  readonly title = 'Internal server error';
}

export function problemFromError(error: unknown, requestId?: string): ProblemDetails {
  if (error instanceof AppError) {
    return error.toProblem(requestId);
  }
  const internal = new InternalError('An unexpected error occurred');
  return internal.toProblem(requestId);
}
