import type { Context } from 'hono';

import { ValidationError } from '../../domain/errors.js';

export async function parseJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }
}
