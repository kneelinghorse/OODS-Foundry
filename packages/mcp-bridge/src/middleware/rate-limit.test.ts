import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { rateLimitOptions } from './rate-limit.js';

describe('bridge rate limit refusal (s206-m02)', () => {
  it('refuses with 429 and the bridge error envelope, not a 500', async () => {
    const server = Fastify();
    await server.register(rateLimit, rateLimitOptions);
    server.get('/tools', { config: { rateLimit: { max: 2, timeWindow: '1 minute' } } }, async () => ({ tools: [] }));
    try {
      const allowed = [await server.inject('/tools'), await server.inject('/tools')];
      expect(allowed.map(response => response.statusCode)).toEqual([200, 200]);
      expect(allowed[1]!.headers['x-ratelimit-remaining']).toBe('0');
      const refused = await server.inject('/tools');
      expect(refused.statusCode).toBe(429);
      expect(refused.headers['retry-after']).toBe('60');
      expect(refused.headers['x-ratelimit-limit']).toBe('2');
      const body = refused.json<{ error: { code: string; message: string; incidentId: string; details: unknown } }>();
      // The status travels on the thrown value but never into the body: the envelope is the bridge's own.
      expect(Object.keys(body)).toEqual(['error']);
      expect(body.error).toMatchObject({ code: 'RATE_LIMITED', message: 'Too many requests - please slow down.', details: { limit: 2, resetInSeconds: 60 } });
      expect(body.error.incidentId).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      await server.close();
    }
  });

  it('limits only the routes that declare a limit', async () => {
    const server = Fastify();
    await server.register(rateLimit, rateLimitOptions);
    server.get('/health', async () => ({ status: 'ok' }));
    try {
      const statuses = [];
      for (let index = 0; index < 5; index += 1) statuses.push((await server.inject('/health')).statusCode);
      expect(statuses).toEqual([200, 200, 200, 200, 200]);
    } finally {
      await server.close();
    }
  });
});
