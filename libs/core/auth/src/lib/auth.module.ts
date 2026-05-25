import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createRemoteJWKSet } from 'jose';

import { AUTH_OPTIONS, JWKS_RESOLVER } from './auth.constants';
import type { AuthModuleOptions } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({})
export class AuthModule {
  static forRoot(options: AuthModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      providers: [
        { provide: AUTH_OPTIONS, useValue: options },
        {
          provide: JWKS_RESOLVER,
          useValue: createRemoteJWKSet(
            options.jwksUrl
              ? new URL(options.jwksUrl)
              : new URL('/api/auth/jwks', options.issuer),
          ),
        },
        // global guards run in provider order: authenticate, then authorize
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    };
  }
}
