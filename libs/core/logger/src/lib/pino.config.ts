import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import type { Params } from 'nestjs-pino';
import type { Options as PinoHttpOptions } from 'pino-http';

import { basePinoOptions } from '@chatarooni/logger-options';

// query-string keys that may carry secrets (OAuth code, verification tokens, …)
const SENSITIVE_QUERY = new Set([
  'token',
  'code',
  'access_token',
  'refresh_token',
  'id_token',
  'secret',
  'password',
  'otp',
  'jwt',
]);

// mask sensitive query-param values in place; pino redact can't reach inside a URL
function sanitizeUrl(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/([?&])([^&=]+)=([^&]*)/g, (match, sep, key) =>
    SENSITIVE_QUERY.has(key.toLowerCase()) ? `${sep}${key}=[REDACTED]` : match,
  );
}

const pinoHttpOptions: PinoHttpOptions = {
  ...basePinoOptions(),

  // app lines carry only reqId; full req/res lands once on the completion line
  quietReqLogger: true,

  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["proxy-authorization"]',
      'req.headers["x-api-key"]',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },

  // surface the authenticated user (set by JwtAuthGuard) as a searchable field
  customProps(req: IncomingMessage) {
    const sub = (req as IncomingMessage & { user?: { sub?: string } }).user?.sub;
    return sub ? { userId: sub } : {};
  },

  serializers: {
    req(req: IncomingMessage) {
      return {
        method: req.method,
        url: sanitizeUrl(req.url),
        headers: req.headers,
      };
    },
    // pino-std-serializers passes a wrapped res, not a ServerResponse
    res(res: { statusCode: number }) {
      return { statusCode: res.statusCode };
    },
  },

  customLogLevel(_req: IncomingMessage, res: ServerResponse, err?: Error) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  // X-Railway-Request-Id → OTel trace_id → uuid
  genReqId(req: IncomingMessage) {
    const upstream = req.headers['x-railway-request-id'];
    if (typeof upstream === 'string') return upstream;
    const span = trace.getSpan(context.active());
    if (span) {
      const ctx = span.spanContext();
      if (isSpanContextValid(ctx)) return ctx.traceId;
    }
    return randomUUID();
  },
};

// '/' prefix-matches every route under the global prefix; '*' is invalid in Express 5
export const pinoModuleOptions: Params = {
  pinoHttp: pinoHttpOptions,
  forRoutes: ['/'],
};
