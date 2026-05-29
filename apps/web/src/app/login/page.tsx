import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';
import { MascotCluster } from '@/components/mascot';
import { getSession } from '@/lib/auth-session';

export const metadata: Metadata = {
  title: 'Sign in',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; error?: string }>;
}) {
  const [session, sp] = await Promise.all([getSession(), searchParams]);
  const isAnonymous = session?.user?.isAnonymous ?? false;

  // OAuth signup is disabled, so signing in with a provider that has no account
  // dead-ends here. Don't strand them — send them to the gate (where accounts
  // actually begin) with a notice, instead of a confusing message on /login.
  if (sp.error === 'signup_disabled') redirect('/chat?notice=no-account');

  // ?intent=claim only means something for an anon (the guest being upgraded).
  // For a logged-out or real visitor it's inert and misleading — drop it.
  if (sp.intent === 'claim' && !isAnonymous) redirect('/login');

  return (
    <section className="relative w-full overflow-hidden" data-lock-overscroll>
      <MascotCluster />
      <main className="relative z-10 mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-4 sm:px-6">
        {/* Suspense boundary required because LoginForm uses
            useSearchParams (reads ?error= and ?intent=). Without it, Next.js
            can't statically prerender the shell — fails the build. */}
        <Suspense fallback={null}>
          <LoginForm isAnonymous={isAnonymous} />
        </Suspense>
      </main>
    </section>
  );
}
