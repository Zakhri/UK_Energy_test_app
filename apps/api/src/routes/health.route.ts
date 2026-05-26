import { logger } from '../infra/logger.js';
import { createTypedRoute } from './_lib/typed-route.js';

export const healthRoute = createTypedRoute();

healthRoute.get('/health', (c) => {
  const dependencies = {
    gemini: (process.env.GEMINI_API_KEY ?? process.env.GEMINI_KEY_PARAM) ? 'configured' : 'missing',
    dynamodb: process.env.DYNAMODB_TABLE ? 'configured' : 'missing',
    carbonIntensity: 'reachable',
    weather: 'reachable',
    entsoe:
      (process.env.ENTSOE_API_KEY ?? process.env.ENTSOE_KEY_PARAM) ? 'configured' : 'fallback',
  };

  logger.debug({ dependencies }, 'health check');

  return c.json({
    status: 'ok',
    environment: process.env.ENVIRONMENT ?? 'local',
    timestamp: new Date().toISOString(),
    dependencies,
  });
});
