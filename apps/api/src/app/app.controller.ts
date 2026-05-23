import { Controller, Get } from '@nestjs/common';
import {
  Authenticated,
  CurrentUser,
  Public,
  Roles,
  type AuthUser,
} from '@blurchat/auth';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getData() {
    return this.appService.getData();
  }

  // any authenticated user; echoes back the verified claims
  @Authenticated()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  // requires a valid JWT AND role=admin
  @Roles('admin')
  @Get('admin')
  admin(@CurrentUser('email') email: string) {
    return { message: `hello admin ${email}` };
  }
}
