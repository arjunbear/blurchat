import type { DynamicModule } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { pinoModuleOptions } from './pino.config';

export const LoggerModule: DynamicModule = {
  ...PinoLoggerModule.forRoot(pinoModuleOptions),
  global: true,
};
