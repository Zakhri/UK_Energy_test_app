import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { recommendationsQuerySchema } from '@uk-energy/shared';

import type { AppEnv } from '../api.js';
import { getContainer } from '../application/container.js';
import {
  generateRecommendations,
  type RecommendationStage,
} from '../application/generate-recommendations.js';
import { ValidationError } from '../domain/errors.js';
import { problemFromError } from '../domain/errors.js';
import { safeZodIssues } from '../infra/_lib/zod-issues.js';
import { createTypedRoute } from './_lib/typed-route.js';

export const recommendationsRoute = createTypedRoute();

function parseQuery(c: Context<AppEnv>) {
  const rawQuery = {
    goal: c.req.query('goal'),
    region: c.req.query('region'),
    kwh: c.req.query('kwh'),
    deadline: c.req.query('deadline'),
    preferences: c.req.query('preferences'),
    note: c.req.query('note'),
  };
  const parsed = recommendationsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new ValidationError('Invalid recommendations query', {
      issues: safeZodIssues(parsed.error),
    });
  }
  return parsed.data;
}

recommendationsRoute.get('/recommendations', async (c) => {
  const requestId = c.get('requestId');
  const query = parseQuery(c);
  const container = await getContainer();
  const response = await generateRecommendations(container, query, requestId);
  return c.json(response);
});

recommendationsRoute.get('/recommendations/stream', (c) => {
  const requestId = c.get('requestId');
  const logger = c.get('logger');

  return streamSSE(c, async (stream) => {
    let query;
    try {
      query = parseQuery(c);
    } catch (error) {
      const problem = problemFromError(error as Error, requestId);
      await stream.writeSSE({ event: 'error', data: JSON.stringify(problem) });
      return;
    }

    const heartbeat = setInterval(() => {
      void stream.writeSSE({ data: '', event: 'heartbeat' });
    }, 4_000);

    try {
      const container = await getContainer();
      const response = await generateRecommendations(container, query, requestId, {
        onStage: async (stage: RecommendationStage) => {
          await stream.writeSSE({ event: 'stage', data: JSON.stringify({ name: stage }) });
        },
      });
      await stream.writeSSE({ event: 'complete', data: JSON.stringify(response) });
    } catch (error) {
      logger.error(
        { err: error instanceof Error ? { message: error.message, name: error.name } : error },
        'sse stream failed',
      );
      const problem = problemFromError(error as Error, requestId);
      await stream.writeSSE({ event: 'error', data: JSON.stringify(problem) });
    } finally {
      clearInterval(heartbeat);
    }
  });
});
