import { Module } from '@nestjs/common';
import { LoggerModule } from '@chatarooni/logger';
import { AuthModule } from '@chatarooni/auth';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    LoggerModule.forRoot(),
    AuthModule.forRoot({
      issuer: process.env.AUTH_ISSUER ?? 'http://localhost:3001',
      audience: process.env.AUTH_AUDIENCE,
      jwksUrl: process.env.AUTH_JWKS_URL,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
