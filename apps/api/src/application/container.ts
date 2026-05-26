import type { AppConfig } from '../infra/config.js';
import { loadConfig } from '../infra/config.js';
import type { CacheRepository } from '../infra/cache/index.js';
import { buildCacheRepository } from '../infra/cache/index.js';
import type { CarbonIntensityClient } from '../infra/clients/carbon-intensity.client.js';
import { createCarbonIntensityClient } from '../infra/clients/carbon-intensity.client.js';
import type { OpenMeteoClient } from '../infra/clients/open-meteo.client.js';
import { createOpenMeteoClient } from '../infra/clients/open-meteo.client.js';
import type { EntsoeClient } from '../infra/clients/entsoe.client.js';
import { createEntsoeClient } from '../infra/clients/entsoe.client.js';
import type { GeminiClient } from '../infra/ai/gemini.client.js';
import { createGeminiClient } from '../infra/ai/gemini.client.js';
import { AiPipeline } from '../infra/ai/pipeline.js';
import { RateLimiter } from '../infra/ai/rate-limiter.js';
import { TelemetryRecorder } from '../infra/ai/telemetry.js';

export interface AppContainer {
  readonly config: AppConfig;
  readonly cache: CacheRepository;
  readonly carbonClient: CarbonIntensityClient;
  readonly weatherClient: OpenMeteoClient;
  readonly entsoeClient: EntsoeClient;
  readonly geminiClient: GeminiClient;
  readonly pipeline: AiPipeline;
  readonly telemetry: TelemetryRecorder;
  readonly rateLimiter: RateLimiter;
}

export interface ContainerOverrides {
  readonly cache?: CacheRepository;
  readonly carbonClient?: CarbonIntensityClient;
  readonly weatherClient?: OpenMeteoClient;
  readonly entsoeClient?: EntsoeClient;
  readonly geminiClient?: GeminiClient;
}

let cachedContainer: AppContainer | null = null;
let inflight: Promise<AppContainer> | null = null;

export async function getContainer(): Promise<AppContainer> {
  if (cachedContainer) return cachedContainer;
  if (inflight) return inflight;
  inflight = buildContainer();
  cachedContainer = await inflight;
  inflight = null;
  return cachedContainer;
}

export async function buildContainer(overrides: ContainerOverrides = {}): Promise<AppContainer> {
  const config = await loadConfig();
  const cache = overrides.cache ?? buildCacheRepository(config);
  const carbonClient = overrides.carbonClient ?? createCarbonIntensityClient();
  const weatherClient = overrides.weatherClient ?? createOpenMeteoClient();
  const entsoeClient =
    overrides.entsoeClient ??
    createEntsoeClient({
      ...(config.entsoeApiKey ? { apiKey: config.entsoeApiKey } : {}),
      areaCode: config.entsoeAreaCode,
    });
  const geminiClient =
    overrides.geminiClient ?? createGeminiClient({ apiKey: config.geminiApiKey });
  const telemetry = new TelemetryRecorder(cache);
  const rateLimiter = new RateLimiter(cache, {
    modelId: config.geminiPrimaryModel,
    rpmLimit: config.geminiRpmLimit,
    rpdLimit: config.geminiRpdLimit,
    dailyBudgetUsd: config.geminiDailyBudgetUsd,
  });
  const pipeline = new AiPipeline({
    cache,
    gemini: geminiClient,
    rateLimiter,
    telemetry,
    modelId: config.geminiPrimaryModel,
  });

  return {
    config,
    cache,
    carbonClient,
    weatherClient,
    entsoeClient,
    geminiClient,
    pipeline,
    telemetry,
    rateLimiter,
  };
}

export function __resetContainer(): void {
  cachedContainer = null;
  inflight = null;
}
