import { getContainer } from '../application/container.js';
import { getAiMetrics } from '../application/get-ai-metrics.js';
import { createTypedRoute } from './_lib/typed-route.js';

export const metricsRoute = createTypedRoute();

metricsRoute.get('/metrics/ai', async (c) => {
  const container = await getContainer();
  const metrics = await getAiMetrics(container.cache);
  return c.json(metrics);
});
