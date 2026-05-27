'use client';

import { useEffect } from 'react';
import './global.css';

// Replaces the root layout when an uncaught client render error escapes every
// nested error.tsx boundary. Must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const payload = JSON.stringify({
      digest: error.digest,
      message: error.message,
      stack: error.stack,
      name: error.name,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
    });

    const blob = new Blob([payload], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/log-client-error', blob)) {
      // sendBeacon returned false (or is missing) — fall back to keepalive fetch
      void fetch('/api/log-client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch((err: unknown) => {
        console.error('failed to report client error', err);
      });
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Something went wrong
          </p>
          <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            That&apos;s on <span className="text-primary">us</span>
          </h1>
          <p className="mt-4 max-w-md text-balance text-foreground/80">
            An unexpected error occurred. We&apos;ve logged it and will take a
            look.
          </p>
          <button
            onClick={reset}
            className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Try again
          </button>
          {error.digest && (
            <p className="mt-6 text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
