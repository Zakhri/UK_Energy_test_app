import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

export interface AppConfig {
  environment: string;
  allowedOrigin: string;
  dynamoTable: string;
  dynamoEndpoint?: string;
  geminiApiKey: string;
  geminiPrimaryModel: string;
  geminiDailyBudgetUsd: number;
  geminiMaxInputTokens: number;
  geminiMaxOutputTokens: number;
  geminiRpmLimit: number;
  geminiRpdLimit: number;
  promptVersion: string;
  entsoeApiKey?: string;
  entsoeAreaCode: string;
}

let cachedConfig: AppConfig | null = null;
let cachedAt = 0;
const CONFIG_TTL_MS = 15 * 60 * 1000;

const ssmClient = new SSMClient({});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Required env var ${name} is not set`);
  }
  return value;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadFromSsm(parameterName: string): Promise<string> {
  const result = await ssmClient.send(
    new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
  );
  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter ${parameterName} returned empty value`);
  }
  return value;
}

async function resolveGeminiKey(): Promise<string> {
  const direct = process.env.GEMINI_API_KEY;
  if (direct && direct !== 'set-via-shell-env') return direct;

  const paramName = process.env.GEMINI_KEY_PARAM;
  if (!paramName) {
    throw new Error('Neither GEMINI_API_KEY nor GEMINI_KEY_PARAM is set');
  }
  return loadFromSsm(paramName);
}

async function resolveEntsoeKey(): Promise<string | undefined> {
  const direct = process.env.ENTSOE_API_KEY;
  if (direct) return direct;

  const paramName = process.env.ENTSOE_KEY_PARAM;
  if (!paramName) return undefined;
  try {
    return await loadFromSsm(paramName);
  } catch {
    return undefined;
  }
}

export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig && Date.now() - cachedAt < CONFIG_TTL_MS) {
    return cachedConfig;
  }

  const [geminiApiKey, entsoeApiKey] = await Promise.all([resolveGeminiKey(), resolveEntsoeKey()]);

  const config: AppConfig = {
    environment: process.env.ENVIRONMENT ?? 'local',
    allowedOrigin: process.env.ALLOWED_ORIGIN ?? '*',
    dynamoTable: requireEnv('DYNAMODB_TABLE'),
    dynamoEndpoint: process.env.DYNAMODB_ENDPOINT,
    geminiApiKey,
    geminiPrimaryModel: process.env.GEMINI_PRIMARY_MODEL ?? 'gemini-3.1-flash-lite',
    geminiDailyBudgetUsd: readFloat('GEMINI_DAILY_BUDGET_USD', 0.5),
    geminiMaxInputTokens: readInt('GEMINI_MAX_INPUT_TOKENS', 4000),
    geminiMaxOutputTokens: readInt('GEMINI_MAX_OUTPUT_TOKENS', 1500),
    geminiRpmLimit: readInt('GEMINI_RPM_LIMIT', 15),
    geminiRpdLimit: readInt('GEMINI_RPD_LIMIT', 500),
    promptVersion: process.env.PROMPT_VERSION ?? 'v1',
    ...(entsoeApiKey ? { entsoeApiKey } : {}),
    entsoeAreaCode: process.env.ENTSOE_AREA_CODE ?? '10Y1001A1001A92E',
  };

  cachedConfig = config;
  cachedAt = Date.now();
  return config;
}

/** Test-only: reset the cache so unit tests don't share state. */
export function __resetConfigCache(): void {
  cachedConfig = null;
  cachedAt = 0;
}
