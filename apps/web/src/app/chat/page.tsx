import type { Metadata } from 'next';
import { getSession } from '@/lib/auth-session';
import { AnonymousBanner } from '@/components/anonymous-banner';
import { SessionRefresh } from '@/components/session-refresh';
import { BeforeYouStart } from '@/components/before-you-start';
import { NoticeToast } from '@/components/notice-toast';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { SidebarDrawer } from '@/components/chat/sidebar-drawer';
import { BrandMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Chat',
  robots: { index: false, follow: false },
};

// Plain route (like /login) — no marketing chrome, no route group. The page
// owns its own full-screen layout, rendering directly under the root layout.
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; notice?: string }>;
}) {
  const [session, sp] = await Promise.all([getSession(), searchParams]);
  const user = session?.user;

  // The gate is mandatory: no gender (which includes being logged out) means
  // no chatting. It collects gender + 18+/Terms consent and lazily creates a
  // gendered anonymous session — the only way to enter. Every real account has
  // a gender (required at creation), so a logged-in user never sees the gate.
  // The shell still renders behind the gate (dimmed); `sidebarUser = null` then
  // drops the Premium/profile sections since there's no account yet.
  const gated = !user?.gender;

  // ?upgraded=1 → arrived right after an anon→real transition (claim/sign-in).
  // The DB is updated but the cached session cookie still holds the pre-
  // transition snapshot (stale isAnonymous), since linkSocial doesn't re-issue
  // it. SessionRefresh forces a fresh cookie; the flag also suppresses the
  // banner on this first paint so it doesn't flash before the refresh lands.
  const justUpgraded = sp.upgraded === '1';
  const isAnonymous = !gated && !justUpgraded && (user?.isAnonymous ?? false);
  const sidebarUser = gated
    ? null
    : { displayName: user?.displayName ?? null, isAnonymous };

  return (
    <div className="flex h-svh flex-col" data-lock-overscroll>
      {!gated && justUpgraded && <SessionRefresh />}
      {isAnonymous && <AnonymousBanner />}

      {/* Shell: a permanent sidebar (md+) beside the chat surface; below md the
          sidebar collapses into a drawer opened from the top-bar ☰. Renders in
          every state — while gated it sits dimmed behind the gate overlay. Pad
          for the iOS notch only when no banner already consumes it. */}
      {/* Desktop top bar (Chitchat-style): the logo sits in a sidebar-width
          column whose right border continues the <aside> divider below, so the
          wordmark lines up on the same row as the main header. md+ only —
          mobile keeps the in-main ☰ bar instead. */}
      <header className="hidden h-12 shrink-0 items-center border-b border-border md:flex">
        <div className="flex h-full w-64 shrink-0 items-center border-r border-border bg-(--sidebar) px-3">
          <BrandMark href="/" size="md" />
        </div>
        <div className="flex h-full flex-1 items-center px-4">
          <span className="text-sm font-medium text-muted-foreground">
            Text Chat
          </span>
        </div>
      </header>

      <div
        className={cn(
          'flex min-h-0 flex-1',
          !isAnonymous && 'pt-[env(safe-area-inset-top)]',
        )}
      >
        <aside className="hidden w-64 shrink-0 border-r border-border bg-(--sidebar) md:flex md:flex-col">
          <ChatSidebar user={sidebarUser} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
            <SidebarDrawer banner={isAnonymous}>
              <ChatSidebar user={sidebarUser} />
            </SidebarDrawer>
            <span className="text-sm font-medium text-muted-foreground">
              Text Chat
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center px-4 text-center">
            <p className="text-muted-foreground">Chat goes here.</p>
          </div>
        </main>
      </div>

      {/* Gate — a dimmed modal over the shell. Mandatory/non-dismissible (no
          account = no chatting), so a plain scrim rather than a Dialog. Mobile:
          docked to the bottom as a sheet; sm+: centered. notice=no-account →
          a sign-in with no account yet (OAuth signup off); shown as a toast. */}
      {gated && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 sm:items-center sm:justify-center sm:px-4">
          {sp.notice === 'no-account' && (
            <NoticeToast
              title="No account found"
              description="Start chatting now — you can claim it later."
            />
          )}
          <BeforeYouStart />
        </div>
      )}
    </div>
  );
}
