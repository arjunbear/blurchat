// DI tokens
export const AUTH_OPTIONS = Symbol('AUTH_OPTIONS');
export const JWKS_RESOLVER = Symbol('JWKS_RESOLVER');

// metadata keys set by the decorators, read by the guards
export const IS_PUBLIC_KEY = 'blurchat:isPublic';
export const ROLES_KEY = 'blurchat:roles';
