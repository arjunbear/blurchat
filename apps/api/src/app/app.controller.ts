import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Post('echo/:id')
  echo(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.appService.echo(id, body);
  }
}
