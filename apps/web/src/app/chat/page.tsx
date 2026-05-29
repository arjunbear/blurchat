import type { Metadata } from 'next';
import { getSession } from '@/lib/auth-session';
import { AnonymousBanner } from '@/components/anonymous-banner';
import { SessionRefresh } from '@/components/session-refresh';
import { BeforeYouStart } from '@/components/before-you-start';

export const metadata: Metadata = {
  title: 'Chat',
  robots: { index: false, follow: false },
};

// Plain route (like /login) — no marketing chrome, no route group. The page
// owns its own full-screen layout, rendering directly under the root layout.
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const [session, sp] = await Promise.all([getSession(), searchParams]);

  // The gate is mandatory: no gender (which includes being logged out) means
  // no chatting. It collects gender + 18+/Terms consent and lazily creates a
  // gendered anonymous session — the only way to enter. Every real account has
  // a gender (required at creation), so a logged-in user never sees the gate.
  if (!session?.user?.gender) {
    return (
      // Mobile: dock the gate to the bottom as a sheet. sm+: centered modal.
      <main className="flex h-svh flex-col justify-end sm:items-center sm:justify-center sm:px-4">
        <BeforeYouStart />
      </main>
    );
  }

  // ?upgraded=1 → arrived right after an anon→real transition (claim/sign-in).
  // The DB is updated but the cached session cookie still holds the pre-
  // transition snapshot (stale isAnonymous), since linkSocial doesn't re-issue
  // it. SessionRefresh forces a fresh cookie; the flag also suppresses the
  // banner on this first paint so it doesn't flash before the refresh lands.
  const justUpgraded = sp.upgraded === '1';
  const isAnonymous = !justUpgraded && (session.user.isAnonymous ?? false);

  return (
    <div className="flex h-svh flex-col">
      {justUpgraded && <SessionRefresh />}
      {isAnonymous && <AnonymousBanner />}
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <p className="text-muted-foreground">Chat goes here.</p>
      </main>
    </div>
  );
}
