import { Hono } from 'hono';
import { handle } from 'hono/aws-lambda';
import { cors } from 'hono/cors';
import { ulid } from 'ulid';

import { problemFromError } from './domain/errors.js';
import { logger } from './infra/logger.js';
import { compareRoute } from './routes/compare.route.js';
import { healthRoute } from './routes/health.route.js';
import { insightsRoute } from './routes/insights.route.js';
import { metricsRoute } from './routes/metrics.route.js';
import { recommendationsRoute } from './routes/recommendations.route.js';
import { signalsRoute } from './routes/signals.route.js';

export type ContextVariables = {
  requestId: string;
  logger: typeof logger;
};

export type AppEnv = { Variables: ContextVariables };

const app = new Hono<{ Variables: ContextVariables }>();

app.use('*', async (c, next) => {
  const requestId = c.req.header('x-amzn-trace-id') ?? c.req.header('x-request-id') ?? ulid();
  c.set('requestId', requestId);
  c.set('logger', logger.child({ requestId }));
  c.header('X-Request-Id', requestId);
  await next();
});

app.use(
  '*',
  cors({
    origin: process.env.ALLOWED_ORIGIN ?? '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 600,
  }),
);

const api = new Hono<{ Variables: ContextVariables }>();
api.route('/', healthRoute);
api.route('/', signalsRoute);
api.route('/', recommendationsRoute);
api.route('/', compareRoute);
api.route('/', insightsRoute);
api.route('/', metricsRoute);

app.route('/api', api);

app.onError((error, c) => {
  const requestId = c.get('requestId');
  const problem = problemFromError(error, requestId);
  c.get('logger').error(
    { err: error instanceof Error ? { message: error.message, name: error.name } : error, problem },
    'request failed',
  );
  return c.json(problem, problem.status as 400 | 404 | 422 | 429 | 500 | 503, {
    'Content-Type': 'application/problem+json',
  });
});

app.notFound((c) => {
  const requestId = c.get('requestId');
  return c.json(
    {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `Route ${c.req.method} ${c.req.path} does not exist`,
      instance: requestId,
    },
    404,
    { 'Content-Type': 'application/problem+json' },
  );
});

export const handler = handle(app);
export { app };
