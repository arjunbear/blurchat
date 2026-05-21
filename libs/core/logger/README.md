# @blurchat/logger

Pino + OpenTelemetry logger for NestJS. Injects `trace_id` / `span_id` into log lines via a pino mixin reading the active OTel span.

## Wiring

```ts
// main.ts — order matters
import '@blurchat/logger/start';   // first import, side-effect OTel SDK

import { NestFactory } from '@nestjs/core';
import { Logger } from '@blurchat/logger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

```ts
// app.module.ts
import { LoggerModule } from '@blurchat/logger';

@Module({ imports: [LoggerModule.forRoot()] })
export class AppModule {}
```

HTTP request logging is nestjs-pino's own middleware, scoped via `forRoutes: ['/']` in `pino.config.ts`. The default `'*'` is invalid under NestJS 11's Express 5 (path-to-regexp@8); `'/'` prefix-matches every route under the global prefix in one pass — see [iamolegga/nestjs-pino#1849](https://github.com/iamolegga/nestjs-pino/issues/1849).

## Injecting a typed logger

For a per-class logger with context tagged automatically:

```ts
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from '@blurchat/logger';

@Injectable()
export class FooService {
  constructor(
    @InjectPinoLogger(FooService.name) private readonly logger: PinoLogger,
  ) {}

  doThing() {
    this.logger.info({ thingId: 42 }, 'did the thing');
  }
}
```

`Logger` (from `@blurchat/logger`) shadows the one in `@nestjs/common` — don't import both.

## Behaviour

|  | dev | prod |
|---|---|---|
| transport | `pino-pretty`, single-line colored | JSON to stdout |
| default level | `debug` | `info` |

Override level with `LOG_LEVEL` env. `reqId` is picked as: Railway's `X-Railway-Request-Id` → active OTel trace id → uuidv4. `trace_id` is emitted separately by the mixin, so on Railway both ids appear in the log line.

Header redaction is commented out in `pino.config.ts` — incoming headers (including `Authorization` and `Cookie`) appear in clear text. Uncomment the `redact` block to re-enable. Response headers are not logged.

## OTel env

| var | default |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset → SDK doesn't start |
| `OTEL_SERVICE_NAME` | `blurchat-api` |
| `OTEL_SERVICE_VERSION` | `RAILWAY_GIT_COMMIT_SHA[:7]` if set, else absent |
| `NODE_ENV` | `development` (used as `deployment.environment.name`) |
| `OTEL_RESOURCE_ATTRIBUTES` | unset (read by SDK natively) |
| `OTEL_TRACES_SAMPLER` | `AlwaysOn` (set to e.g. `traceidratio` for sampling) |

Endpoint is normalized — trailing slashes and a literal `/v1/traces` suffix are stripped before the SDK rebuilds the URL.

`@opentelemetry/auto-instrumentations-node` patches Node's `http`/`https`, so outgoing axios/fetch/got calls get a child span + `traceparent` header automatically.

## Span attributes added by this lib

Every span carries these resource attributes (set once at SDK init):

| attribute | value |
|---|---|
| `service.name` | from `OTEL_SERVICE_NAME` |
| `deployment.environment.name` | from `NODE_ENV` |
| `cloud.provider` | `'railway'` |
| `service.version` | from `OTEL_SERVICE_VERSION` or `RAILWAY_GIT_COMMIT_SHA[:7]` if set |

HTTP server spans additionally get:

| attribute | value |
|---|---|
| `railway.request_id` | value of incoming `X-Railway-Request-Id` header, when present |

Search by `railway.request_id` in your trace backend to pivot from a Railway dashboard log line to the corresponding trace.
