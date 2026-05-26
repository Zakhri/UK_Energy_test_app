import { getContainer } from '../application/container.js';
import { compareScenarios } from '../application/compare-scenarios.js';
import { ValidationError } from '../domain/errors.js';
import { safeZodIssues } from '../infra/_lib/zod-issues.js';
import { createTypedRoute } from './_lib/typed-route.js';
import { parseJsonBody } from './_lib/parse-json-body.js';
import { compareBodySchema } from '@uk-energy/shared';

export const compareRoute = createTypedRoute();

compareRoute.post('/compare', async (c) => {
  const requestId = c.get('requestId');
  const body = await parseJsonBody(c);

  const parsed = compareBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid compare body', {
      issues: safeZodIssues(parsed.error),
    });
  }

  const container = await getContainer();
  const response = await compareScenarios(container, parsed.data, requestId);
  return c.json(response);
});
