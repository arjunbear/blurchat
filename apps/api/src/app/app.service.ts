import { InjectPinoLogger, PinoLogger } from '@blurchat/logger';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    @InjectPinoLogger(AppService.name) private readonly logger: PinoLogger,
  ) {}

  getData(): { message: string } {
    this.logger.info('AppService.getData called');
    return { message: 'Hello from the other side!' };
  }
}
