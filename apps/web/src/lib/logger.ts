import 'server-only';
import pino from 'pino';
import { basePinoOptions } from '@chatarooni/logger-options';

// trace_id/span_id are injected by @opentelemetry/instrumentation-pino once
// the OTel SDK boots via apps/web/src/instrumentation.ts.
export const logger = pino(basePinoOptions());
