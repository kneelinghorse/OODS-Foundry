import type { RateLimitPluginOptions } from '@fastify/rate-limit';
import { buildErrorPayload } from './errors.js';

/**
 * The bridge's rate-limit plugin options (limits are per route, from bridgeConfig.rateLimit).
 *
 * The plugin THROWS whatever errorResponseBuilder returns, and fastify's error handler takes the response status from
 * the thrown value's `statusCode`. Without one, every refusal answered 500 with a RATE_LIMITED body — on fastify 4 as
 * on 5 (found by the s206-m02 live smoke of the archived bridge). The status is non-enumerable, so the body stays the
 * bridge's error envelope.
 */
export const rateLimitOptions: RateLimitPluginOptions = {
  global: false,
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  errorResponseBuilder: (_request, context) =>
    Object.defineProperty(
      buildErrorPayload('RATE_LIMITED', 'Too many requests - please slow down.', {
        details: {
          limit: context.max,
          resetInSeconds: Math.ceil(context.ttl / 1000),
        },
      }),
      'statusCode',
      { value: context.statusCode, enumerable: false },
    ),
};
