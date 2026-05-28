import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { AUTH_OPTIONS, IS_PUBLIC_KEY, JWKS_RESOLVER } from './auth.constants';
import type { AuthJwtPayload, AuthModuleOptions, AuthUser } from './auth.types';

type JwksResolver = ReturnType<typeof createRemoteJWKSet>;

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(JWKS_RESOLVER) private readonly jwks: JwksResolver,
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestLike>();
    const token = this.extractBearer(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: AuthJwtPayload;
    try {
      ({ payload } = await jwtVerify<AuthJwtPayload>(token, this.jwks, {
        issuer: this.options.issuer,
        audience: this.options.audience ?? this.options.issuer,
      }));
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (
      !payload.sub ||
      !payload.email ||
      !payload.role ||
      !payload.publicId ||
      !payload.displayName
    ) {
      throw new UnauthorizedException('Token missing required claims');
    }

    request.user = payload as AuthUser;
    return true;
  }

  private extractBearer(request: RequestLike): string | undefined {
    const header = request.headers['authorization'];
    if (typeof header !== 'string') return undefined;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
  }
}
