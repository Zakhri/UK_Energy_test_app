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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({
      title: 'Request failed',
      detail: response.statusText,
    }));
    throw new ApiError(response.status, problem as { title: string; detail: string });
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
