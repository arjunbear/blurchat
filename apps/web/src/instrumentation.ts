import type { Instrumentation } from 'next';

// Next.js auto-detects this file and calls register() once at server boot.
// Delegates to @chatarooni/logger/instrumentation so apps/web shares the
// same OTel SDK + auto-instrumentations as apps/api and apps/auth.
// The NEXT_RUNTIME guard skips Edge — auto-instrumentations-node patches
// Node's http/https and won't load in the Edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@chatarooni/logger/instrumentation');
  }
}

// Fires on every server-side error (render, route handler, generateMetadata,
// server action). On Node we route through pino; on Edge pino isn't loadable,
// so fall back to console.error so the error still reaches stderr.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const fields = {
    err: error,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  };

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('@/lib/logger');
    logger.error(fields, 'server request error');
    return;
  }

  console.error('server request error', fields);
};
