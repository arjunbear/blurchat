import 'server-only';
import pino from 'pino';

// Mirrors the pino config in apps/auth/src/auth.ts and
// libs/core/logger/src/lib/pino.config.ts — keep them in sync.
// trace_id/span_id are injected by @opentelemetry/instrumentation-pino once
// the OTel SDK boots via apps/web/src/instrumentation.ts.
const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  name: process.env.OTEL_SERVICE_NAME,
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
});
