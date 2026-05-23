import { Module } from '@nestjs/common';
import { LoggerModule } from '@blurchat/logger';
import { AuthModule } from '@blurchat/auth';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    LoggerModule.forRoot(),
    AuthModule.forRoot({
      baseUrl: process.env.AUTH_URL ?? 'http://localhost:3001',
      audience: process.env.AUTH_AUDIENCE,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
