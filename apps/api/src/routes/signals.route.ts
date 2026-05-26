import { signalCategorySchema, signalsQuerySchema } from '@uk-energy/shared';

import { getContainer } from '../application/container.js';
import { getSignals } from '../application/get-signals.js';
import { ValidationError } from '../domain/errors.js';
import { safeZodIssues } from '../infra/_lib/zod-issues.js';
import { createTypedRoute } from './_lib/typed-route.js';

export const signalsRoute = createTypedRoute();

signalsRoute.get('/signals/:category', async (c) => {
  const requestId = c.get('requestId');

  const categoryParse = signalCategorySchema.safeParse(c.req.param('category'));
  if (!categoryParse.success) {
    throw new ValidationError('Unsupported signal category', {
      allowed: signalCategorySchema.options,
    });
  }

  const queryParse = signalsQuerySchema.safeParse({
    region: c.req.query('region'),
    windowHours: c.req.query('windowHours'),
  });
  if (!queryParse.success) {
    throw new ValidationError('Invalid signals query', {
      issues: safeZodIssues(queryParse.error),
    });
  }

  const container = await getContainer();
  const result = await getSignals(container, {
    category: categoryParse.data,
    query: queryParse.data,
    requestId,
  });
  return c.json(result);
});
