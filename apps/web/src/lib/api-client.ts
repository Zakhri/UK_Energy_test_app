import type {
  AiMetricsResponse,
  CompareBody,
  CompareResponse,
  RecommendationsQuery,
  RecommendationsResponse,
  RegionCode,
  SignalsResponse,
  TrendsInsightResponse,
} from '@uk-energy/shared';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: { title: string; detail: string; type?: string },
  ) {
    super(`${problem.title}: ${problem.detail}`);
  }
}

function defaultTitleFor(status: number): string {
  if (status === 0) return 'Network error';
  if (status === 504 || status === 502) return 'Upstream service slow';
  if (status >= 500) return 'Server error';
  if (status === 429) return 'Rate-limited';
  if (status >= 400) return 'Request failed';
  return 'Unexpected response';
}

function defaultDetailFor(status: number): string {
  if (status === 504 || status === 502)
    return 'A backing data source is slow or unavailable right now — try again in a moment.';
  if (status === 429) return 'Too many requests — give it a few seconds and retry.';
  if (status >= 500)
    return 'The API hit an unexpected error. The team has been alerted via CloudWatch.';
  return 'The request could not be completed.';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (networkError) {
    // fetch() itself threw — DNS failure, offline, CORS preflight rejected.
    throw new ApiError(0, {
      title: 'Network error',
      detail: networkError instanceof Error ? networkError.message : 'Could not reach the API.',
    });
  }
  if (!response.ok) {
    // Accept three problem shapes:
    //   - RFC7807 problem+json from our Hono `onError`
    //   - APIGW default body `{ "message": "Internal server error" }`
    //   - opaque text / empty body
    const raw = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const title = (typeof raw?.title === 'string' && raw.title) || defaultTitleFor(response.status);
    const detail =
      (typeof raw?.detail === 'string' && raw.detail) ||
      (typeof raw?.message === 'string' && raw.message) ||
      response.statusText ||
      defaultDetailFor(response.status);
    const type = typeof raw?.type === 'string' ? raw.type : undefined;
    throw new ApiError(response.status, { title, detail, ...(type ? { type } : {}) });
  }
  return (await response.json()) as T;
}

export const api = {
  fetchSignals(
    category: 'carbon' | 'weather' | 'price',
    region: RegionCode,
  ): Promise<SignalsResponse> {
    const params = new URLSearchParams({ region });
    return request<SignalsResponse>(`/signals/${category}?${params.toString()}`);
  },

  fetchRecommendations(query: RecommendationsQuery): Promise<RecommendationsResponse> {
    const params = new URLSearchParams({
      goal: query.goal,
      region: query.region,
      kwh: String(query.kwh),
      ...(query.deadline ? { deadline: query.deadline } : {}),
      ...(query.preferences && query.preferences.length > 0
        ? { preferences: query.preferences.join(',') }
        : {}),
      ...(query.note ? { note: query.note } : {}),
    });
    return request<RecommendationsResponse>(`/recommendations?${params.toString()}`);
  },

  postCompare(body: CompareBody): Promise<CompareResponse> {
    return request<CompareResponse>('/compare', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  fetchMetrics(): Promise<AiMetricsResponse> {
    return request<AiMetricsResponse>('/metrics/ai');
  },

  fetchTrends(region: RegionCode): Promise<TrendsInsightResponse> {
    const params = new URLSearchParams({ region });
    return request<TrendsInsightResponse>(`/insights/trends?${params.toString()}`);
  },
};
