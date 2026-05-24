import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import { betterAuth } from 'better-auth';
import { openAPI } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins/admin';
import { bearer } from 'better-auth/plugins/bearer';
import { jwt } from 'better-auth/plugins/jwt';
import { Pool } from 'pg';
import pino from 'pino';

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

const isProd = process.env.NODE_ENV === 'production';

// Better Auth runs outside Nest DI and is loaded by the migrate CLI (which
// can't resolve the @chatarooni/logger path alias), so it gets its own inline
// pino instance — mirrors @chatarooni/logger's config (level / transport / trace).
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
  mixin() {
    const span = trace.getSpan(context.active());
    const ctx = span?.spanContext();
    return ctx && isSpanContextValid(ctx)
      ? { trace_id: ctx.traceId, span_id: ctx.spanId }
      : {};
  },
}).child({ context: 'better-auth' });

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
    minPasswordLength: 8,
    requireEmailVerification: false, // no email service wired yet
  },

  // Google activates only once its credentials are set in env
  socialProviders: {
    ...(googleId && googleSecret
      ? { google: { clientId: googleId, clientSecret: googleSecret } }
      : {}),
  },

  account: {
    accountLinking: { enabled: true, trustedProviders: ['google'] },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  advanced: {
    database: { generateId: 'uuid' }, // record ids as UUIDs (not the default base62)
  },

  plugins: [
    admin(),
    jwt({
      jwt: {
        definePayload: ({ user }) => ({
          email: user.email,
          role: user.role,
        }),
      },
    }),
    bearer(),
    // dev-only interactive API reference at /api/auth/reference
    ...(!isProd ? [openAPI()] : []),
  ],
});
