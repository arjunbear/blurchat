import '@blurchat/logger/start';

import { NestFactory } from '@nestjs/core';
import { Logger, httpLoggerMiddleware } from '@blurchat/logger';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);
  app.use(httpLoggerMiddleware);
  app.flushLogs();

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
    'Bootstrap',
  );
}

bootstrap();
