import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import type { Params } from 'nestjs-pino';
import type { Options as PinoHttpOptions } from 'pino-http';

const isProd = process.env.NODE_ENV === 'production';

type PinoHttpRequest = IncomingMessage & { id: string | number };

const pinoHttpOptions: PinoHttpOptions = {
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),

  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          singleLine: true,
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
        },
      },

  // redact: {
  //   paths: [
  //     'req.headers.authorization',
  //     'req.headers.cookie',
  //     'req.headers["set-cookie"]',
  //   ],
  //   censor: '[REDACTED]',
  // },

  serializers: {
    req(req: PinoHttpRequest) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
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

  mixin() {
    const span = trace.getSpan(context.active());
    if (!span) return {};
    const ctx = span.spanContext();
    if (!isSpanContextValid(ctx)) return {};
    return {
      trace_id: ctx.traceId,
      span_id: ctx.spanId,
      trace_flags: ctx.traceFlags,
    };
  },
};

// '/' prefix-matches every route under the global prefix; '*' is invalid in Express 5
export const pinoModuleOptions: Params = {
  pinoHttp: pinoHttpOptions,
  forRoutes: ['/'],
};
