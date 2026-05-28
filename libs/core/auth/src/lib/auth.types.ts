import type { JWTPayload } from 'jose';

export interface AuthModuleOptions {
  // Expected JWT `iss` (and default `aud`); the public auth service URL.
  issuer: string;
  // Expected `aud` claim; defaults to `issuer`.
  audience?: string;
  // Where to FETCH the JWKS; defaults to `${issuer}/api/auth/jwks`.
  // Override with an internal URL (e.g. Railway private networking) to skip the public hop.
  jwksUrl?: string;
}

// JWT claims minted by the auth service: standard set + our payload fields.
// publicId is the stable cross-service identity (anon→real link preserves it).
// displayName starts as a copy of publicId; will swap to a name generator later.
export interface AuthJwtPayload extends JWTPayload {
  email: string;
  role: string;
  publicId: string;
  displayName: string;
  isAnonymous: boolean;
}

// The verified payload attached to `req.user`, with `sub` guaranteed present.
export interface AuthUser extends AuthJwtPayload {
  sub: string;
}
