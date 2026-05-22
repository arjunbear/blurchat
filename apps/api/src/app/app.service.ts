import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from '@blurchat/logger';

@Injectable()
export class AppService {
  constructor(
    @InjectPinoLogger(AppService.name) private readonly logger: PinoLogger,
  ) {}

  getData(): { message: string } {
    return { message: 'Hello from the other side!' };
  }

  echo(id: string, body: Record<string, unknown>) {
    this.logger.debug({ id, hello: body.hello }, 'echo input');
    return { id, body };
  }
}
