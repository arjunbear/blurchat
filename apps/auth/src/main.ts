import '@blurchat/logger/instrumentation';

import { NestFactory } from '@nestjs/core';
import { Logger } from '@blurchat/logger';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 Auth service running on: http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
