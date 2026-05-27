import { logger } from '@/lib/logger';

const MAX_FIELD = 8192;

function clip(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.length > MAX_FIELD ? value.slice(0, MAX_FIELD) + '…' : value;
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!payload || typeof payload !== 'object') {
    return new Response(null, { status: 400 });
  }

  const p = payload as Record<string, unknown>;
  logger.error(
    {
      digest: clip(p.digest),
      message: clip(p.message),
      stack: clip(p.stack),
      name: clip(p.name),
      path: clip(p.path),
      userAgent: clip(p.userAgent),
    },
    'client render error',
  );

  return new Response(null, { status: 204 });
}
