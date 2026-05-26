import { serve } from '@hono/node-server';

import { app } from './api.js';
import { logger } from './infra/logger.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

const hostname = process.env.HOST ?? '0.0.0.0';

serve({ fetch: app.fetch, port, hostname }, (info) => {
  logger.info({ port: info.port, hostname }, 'local dev server started');
});
