import type { DynamicModule } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { pinoModuleOptions } from './pino.config';

// deferred so it snapshots @InjectPinoLogger contexts after they register
export class LoggerModule {
  static forRoot(): DynamicModule {
    return { ...PinoLoggerModule.forRoot(pinoModuleOptions), global: true };
  }
}
