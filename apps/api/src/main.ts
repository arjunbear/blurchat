import '@chatarooni/logger/instrumentation';

import { NestFactory } from '@nestjs/core';
import { Logger } from '@chatarooni/logger';
import { setupSwagger } from '@chatarooni/swagger';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.enableCors({
    origin: [
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
      ...(process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ],
    credentials: true,
  });

  setupSwagger(app, {
    title: 'chatarooni-api',
    prodUrl: 'https://api.chatarooni.com',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
    'Bootstrap',
  );
}

bootstrap();
