import type { JWTPayload } from 'jose';

export interface AuthModuleOptions {
  // Auth service base URL: origin of the JWKS endpoint and the expected `iss`.
  baseUrl: string;
  // Expected `aud` claim; defaults to `baseUrl` (Better Auth's default).
  audience?: string;
}

// JWT claims minted by the auth service: standard set + our payload fields.
export interface AuthJwtPayload extends JWTPayload {
  email: string;
  role: string;
}

// The verified payload attached to `req.user`, with `sub` guaranteed present.
export interface AuthUser extends AuthJwtPayload {
  sub: string;
}
