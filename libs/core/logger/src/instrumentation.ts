// Must be imported first — auto-instrumentations patch http/https at
// require-time. No-op when OTEL_EXPORTER_OTLP_ENDPOINT is unset.
import type { IncomingMessage } from 'node:http';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const version =
    process.env.OTEL_SERVICE_VERSION ??
    process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7);

  const sdk = new NodeSDK({
    // service.name comes from OTEL_SERVICE_NAME (per service); unset → unknown_service
    resource: resourceFromAttributes({
      'deployment.environment.name': process.env.NODE_ENV ?? 'development',
      'cloud.provider': 'railway',
      ...(version ? { 'service.version': version } : {}),
    }),
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          requestHook(span, request) {
            const headers = (request as IncomingMessage).headers;
            const id = headers?.['x-railway-request-id'];
            if (typeof id === 'string') {
              span.setAttribute('railway.request_id', id);
            }
          },
        },
      }),
    ],
  });

  try {
    sdk.start();

    const shutdown = () => {
      sdk.shutdown().then(
        () => process.exit(0),
        (err) => {
          console.error('[otel] shutdown failed', err);
          process.exit(1);
        },
      );
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  } catch (err) {
    console.error('[otel] failed to start, continuing without tracing', err);
  }
}
