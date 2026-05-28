import { createAuthClient } from 'better-auth/react';
import { anonymousClient } from 'better-auth/client/plugins';

// Auth service lives on a separate origin (auth.chatarooni.com in prod,
// http://localhost:3001 in dev) — set via NEXT_PUBLIC_AUTH_URL. Cross-
// subdomain cookies are configured in apps/auth so the session works
// across the frontend and auth domains.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
  plugins: [anonymousClient()],
});
