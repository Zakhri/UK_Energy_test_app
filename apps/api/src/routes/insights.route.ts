import { regionSchema } from '@uk-energy/shared';

import { getContainer } from '../application/container.js';
import { getTrendsInsight } from '../application/get-trends-insight.js';
import { ValidationError } from '../domain/errors.js';
import { safeZodIssues } from '../infra/_lib/zod-issues.js';
import { createTypedRoute } from './_lib/typed-route.js';

export const insightsRoute = createTypedRoute();

insightsRoute.get('/insights/trends', async (c) => {
  const requestId = c.get('requestId');

  const regionParse = regionSchema.safeParse(c.req.query('region') ?? 'GB-LON');
  if (!regionParse.success) {
    throw new ValidationError('Invalid region', { issues: safeZodIssues(regionParse.error) });
  }

  const container = await getContainer();
  const result = await getTrendsInsight(container, regionParse.data, requestId);
  return c.json(result);
});
