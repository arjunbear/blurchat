import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { openAPI } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins/admin';
import { anonymous } from 'better-auth/plugins/anonymous';
import { bearer } from 'better-auth/plugins/bearer';
import { jwt } from 'better-auth/plugins/jwt';
import { Pool } from 'pg';
import pino from 'pino';
import { v7 as uuidv7 } from 'uuid';
// Relative path (not @chatarooni/auth/fields) because Better Auth's migrate
// CLI uses jiti, which doesn't honor workspace path aliases.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { userAdditionalFields } from '../../../libs/core/auth/src/fields';

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

const facebookId = process.env.FACEBOOK_CLIENT_ID;
const facebookSecret = process.env.FACEBOOK_CLIENT_SECRET;

// prod: parent domain to share the session cookie across subdomains (auth ↔ app)
const cookieDomain = process.env.COOKIE_DOMAIN;

const isProd = process.env.NODE_ENV === 'production';

// Mirrors the pino config in apps/web/src/lib/logger.ts and
// libs/core/logger/src/lib/pino.config.ts — keep them in sync.
// Inlined (not a shared lib) because Better Auth's migrate CLI loads this
// file via jiti which doesn't honor workspace path aliases.
// trace_id/span_id are injected by @opentelemetry/instrumentation-pino.
const baLogger = pino({
  name: process.env.OTEL_SERVICE_NAME,
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          singleLine: true,
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
        },
      },
}).child({ context: 'better-auth' });

// Decode (not verify) the claims of an OAuth ID token. Better Auth already
// validated it during the callback, so we only need to read the payload to
// adopt the provider profile when an anonymous user claims their account.
function decodeIdTokenClaims(
  idToken?: string | null,
): Record<string, unknown> | null {
  const payload = idToken?.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

type ClaimProfile = {
  name?: string;
  image?: string;
  email?: string;
  emailVerified: boolean;
};

// The provider profile to adopt when an anonymous user claims their account.
// Google embeds it in the OAuth ID token; Facebook's web flow returns no ID
// token, so fetch it from the Graph API with the access token. Returns null
// when neither source yields anything.
async function resolveClaimProfile(account: {
  providerId: string;
  idToken?: string | null;
  accessToken?: string | null;
}): Promise<ClaimProfile | null> {
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

  const claims = decodeIdTokenClaims(account.idToken);
  if (claims) {
    return {
      name: str(claims.name),
      image: str(claims.picture),
      email: str(claims.email)?.toLowerCase(),
      emailVerified: claims.email_verified === true,
    };
  }

  if (account.providerId === 'facebook' && account.accessToken) {
    try {
      // Unversioned → Facebook serves a current default; name/email/picture are
      // stable across versions. email is absent for phone-only accounts.
      const res = await fetch(
        `https://graph.facebook.com/me?fields=name,email,picture.type(large)&access_token=${encodeURIComponent(
          account.accessToken,
        )}`,
      );
      if (!res.ok) return null;
      const p = (await res.json()) as {
        name?: string;
        email?: string;
        picture?: { data?: { url?: string } };
      };
      return {
        name: str(p.name),
        image: str(p.picture?.data?.url),
        email: str(p.email)?.toLowerCase(),
        // Facebook verifies emails server-side (you can't attach an address to a
        // FB account without confirming it), even though the Graph API returns
        // no per-email flag — so we trust it as verified. This lets a later
        // same-email sign-in (e.g. Google) auto-link into this account instead
        // of failing with account_not_linked.
        emailVerified: true,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export const auth = betterAuth({
  appName: 'chatarooni',
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  trustedOrigins,

  logger: {
    // emit everything to pino; LOG_LEVEL (pino's level) is the single gate
    level: 'debug',
    log(level, message, ...args) {
      const meta = args.length ? { args } : {};
      if (level === 'error') baLogger.error(meta, message);
      else if (level === 'warn') baLogger.warn(meta, message);
      else if (level === 'debug') baLogger.debug(meta, message);
      else baLogger.info(meta, message);
    },
  },

  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // OAuth-only signup; password is set later via reset flow
    minPasswordLength: 8,
    // TODO: wire sendResetPassword once an email provider (Resend/Postmark/SES) is set up
  },

  // publicId = stable cross-service identity (apps/api uses this, never the
  // internal id). displayName starts as a copy of publicId; later we'll swap
  // the initialization for a random-name generator without changing consumers.
  // Shared with apps/web's auth clients via @chatarooni/auth/fields.
  user: { additionalFields: userAdditionalFields },

  // Generate publicId once at insert time, then mirror to displayName so they
  // share the value. Doing both in one before-hook avoids two independent
  // defaultValue() calls returning different UUIDs.
  // Defensive: if publicId is already set (e.g., a future code path that
  // pre-populates it), don't regenerate.
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          // gender is collected at the /chat gate and ridden in as a query param
          // on signIn.anonymous (?gender=…; the endpoint takes no body). This
          // hook is the only writer (input:false) and the column is required, so
          // reject a create without a valid gender with a clean 400 rather than
          // letting the NOT NULL constraint surface as a 500. The gate guarantees
          // it; this only fires for malformed/direct requests.
          const raw = (ctx as { query?: { gender?: unknown } } | undefined)
            ?.query?.gender;
          if (raw !== 'male' && raw !== 'female') {
            throw new APIError('BAD_REQUEST', {
              message: 'A valid gender is required.',
            });
          }
          const id = user.publicId ? undefined : uuidv7();
          return {
            data: {
              ...user,
              ...(id ? { publicId: id, displayName: id } : {}),
              gender: raw,
            },
          };
        },
      },
    },
    account: {
      create: {
        // The "claim" flow upgrades an anon in place via linkSocial, which
        // links a provider account but leaves the user anonymous with its temp
        // profile. Promote it to a real account and adopt the OAuth profile.
        // Guarded so it only fires for the anon-link case (no-op for ordinary
        // OAuth signups / real users linking a second provider). signIn.anonymous
        // creates no account row, so this never touches a still-guest session.
        after: async (account, ctx) => {
          if (!ctx) return;
          // isAnonymous is an anonymous()-plugin column; the adapter's return
          // type is the base User, so narrow it explicitly.
          const user = (await ctx.context.internalAdapter.findUserById(
            account.userId,
          )) as { isAnonymous?: boolean } | null;
          if (!user?.isAnonymous) return;

          // linkSocial's redirect path doesn't update the user, so pull the
          // provider profile ourselves — ID token for Google, Graph API for
          // Facebook (its web flow returns no ID token).
          const profile = await resolveClaimProfile(account);

          const updates: Record<string, unknown> = { isAnonymous: false };
          if (profile?.name) updates.name = profile.name; // audit only — not displayed
          if (profile?.image) updates.image = profile.image;

          // email is UNIQUE: only adopt if no other account already holds it
          // (e.g. a separate email/password account with the same address).
          // Otherwise keep the temp email — they still sign in via the provider.
          // (A Facebook account with no email simply has nothing to adopt.)
          const email = profile?.email;
          if (
            email &&
            !(await ctx.context.internalAdapter.findUserByEmail(email))
          ) {
            updates.email = email;
            updates.emailVerified = profile.emailVerified;
          } else if (email) {
            baLogger.warn(
              { userId: account.userId },
              'claim: provider email already in use — keeping temp email',
            );
          }

          await ctx.context.internalAdapter.updateUser(account.userId, updates);
        },
      },
    },
  },

  // Each provider activates only once its credentials are set in env.
  // OAuth signup is OFF for all of them (disableSignUp): signIn.social only
  // signs INTO existing accounts, never creates one. New accounts are born only
  // via the gendered /chat gate (signIn.anonymous) → claim (linkSocial), so
  // every account has a gender. A never-seen provider identity → signup_disabled.
  // (linkSocial/claim is unaffected — it links to the existing anon.)
  socialProviders: {
    ...(googleId && googleSecret
      ? {
          google: {
            clientId: googleId,
            clientSecret: googleSecret,
            prompt: 'select_account', // always show the account picker
            disableSignUp: true,
          },
        }
      : {}),
    ...(facebookId && facebookSecret
      ? {
          facebook: {
            clientId: facebookId,
            clientSecret: facebookSecret,
            // Facebook can omit email even with the permission granted
            // (phone-only accounts / no valid email on file). Better Auth
            // requires an email to build the profile — it throws before the
            // disableSignUp check — so synthesize a stable placeholder from the
            // app-scoped FB id when it's absent. `.invalid` is the RFC 6761
            // reserved TLD that can never resolve, so no real inbox is ever
            // addressed; the value is unique per account, so it can't collide.
            // These users sign in via Facebook, never email.
            mapProfileToUser: (profile) => ({
              email: profile.email ?? `${profile.id}@facebook.invalid`,
            }),
            disableSignUp: true,
          },
        }
      : {}),
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'facebook'],
      updateUserInfoOnLink: true,
      // An anonymous user's email is a generated temp address, so it never
      // matches the real email of the provider being linked. Required for the
      // anon→real "claim" flow (linkSocial); only loosens explicit, user-
      // initiated linking (not sign-in auto-linking), and only trusted
      // providers (Google, Facebook) are enabled.
      allowDifferentEmails: true,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  // OAuth callback errors that fail BEFORE the state is looked up (e.g. a
  // replayed/expired state from a back-button re-submit of the Google picker)
  // can't recover the per-request errorCallbackURL, so Better Auth would fall
  // back to its built-in error page on the auth origin. Point that fallback at
  // the web app's /login (trustedOrigins[0] = the web origin, local 5173 / prod
  // apex), where ?error= is surfaced as a message with a retry. The recoverable
  // cases (e.g. signup_disabled) still use the per-call errorCallbackURL.
  onAPIError: { errorURL: `${trustedOrigins[0]}/login` },

  advanced: {
    database: { generateId: 'uuid' }, // record ids as UUIDs (not the default base62)
    // share the session cookie across subdomains (auth ↔ app); also avoids Safari ITP
    ...(cookieDomain
      ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } }
      : {}),
  },

  // Default is 100 req / 10s per IP across all endpoints — fine for general
  // traffic but leaves auth-sensitive routes wide open to brute-force / email
  // abuse. Storage is in-memory (per-process); switch to 'database' if
  // apps/auth scales horizontally so IPs can't reset by hitting a fresh instance.
  rateLimit: {
    customRules: {
      '/sign-in/email': { window: 60 * 15, max: 20 }, // brute-force gate
      '/request-password-reset': { window: 60 * 60, max: 10 }, // email-spam gate
    },
  },

  plugins: [
    admin(),
    // No onLinkAccount: OAuth signup is disabled (google.disableSignUp), so an
    // anon can never reach the old Path A (publicId transfer), and Path B (sign
    // into an existing account) is the plugin's default (delete anon, sign in).
    // Upgrade = linkSocial in-place + databaseHooks.account.create.after.
    anonymous(),
    jwt({
      jwt: {
        // sub = publicId (not the internal user.id, which changes on anon→real
        // link). Keeps the internal id fully private to apps/auth and makes the
        // token self-consistent — everything identifying the user is publicId.
        getSubject: ({ user }) => user.publicId,
        // No email — apps/api keys everything off publicId. Keeping email out
        // avoids PII in logs/traces and shrinks the leak blast-radius. If
        // moderation ever needs it, look it up via getUser(publicId).
        definePayload: ({ user }) => ({
          role: user.role,
          publicId: user.publicId,
          displayName: user.displayName,
          isAnonymous: user.isAnonymous ?? false,
          gender: user.gender, // 'male' | 'female' — apps/api matchmaking
        }),
      },
    }),
    bearer(),
    // dev-only interactive API reference at /api/auth/reference
    ...(!isProd ? [openAPI()] : []),
  ],
});
