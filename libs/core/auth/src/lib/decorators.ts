import {
  SetMetadata,
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants';
import type { AuthUser } from './auth.types';

// Open this route to unauthenticated requests (opts out of the global guard).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Require a logged-in user; documents intent + shows the lock in Swagger.
export const Authenticated = () => applyDecorators(ApiBearerAuth());

// Require a logged-in user with one of the given roles.
export const Roles = (...roles: string[]) =>
  applyDecorators(SetMetadata(ROLES_KEY, roles), ApiBearerAuth());

// Inject the verified user (or one field of it) into a handler parameter.
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const { user } = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return field ? user?.[field] : user;
  },
);
