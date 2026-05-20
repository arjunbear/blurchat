import pinoHttp from 'pino-http';

import { pinoHttpOptions } from './pino.config';

// Mount via app.use() in main.ts. Replaces nestjs-pino's auto-middleware
// which doesn't fire under NestJS 11 + global prefix (#1849).
export const httpLoggerMiddleware = pinoHttp(pinoHttpOptions);
