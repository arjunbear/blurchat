import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { LoggerModule } from '@chatarooni/logger';

import { auth } from '../auth';

@Module({
  imports: [LoggerModule.forRoot(), AuthModule.forRoot({ auth })],
})
export class AppModule {}
