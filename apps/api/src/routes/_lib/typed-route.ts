import { Hono } from 'hono';

import type { AppEnv } from '../../api.js';

export const createTypedRoute = (): Hono<AppEnv> => new Hono<AppEnv>();
