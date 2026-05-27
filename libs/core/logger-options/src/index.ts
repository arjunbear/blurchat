import type { LoggerOptions } from 'pino';

// Shared pino config — spread into pino() (apps/auth, apps/web) or into
// pino-http options (libs/core/logger). Single source of truth so the three
// services don't drift on level/transport/name.
// trace_id/span_id are injected by @opentelemetry/instrumentation-pino, which
// boots via @chatarooni/logger/instrumentation in each service's entrypoint.
export function basePinoOptions(): LoggerOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
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
  };
}
