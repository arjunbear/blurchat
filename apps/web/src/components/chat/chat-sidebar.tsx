import { Button } from '@/components/ui/button';
import { SidebarProfile } from './sidebar-profile';
import { SidebarTabs } from './sidebar-tabs';

type SidebarUser = { displayName?: string | null; isAnonymous: boolean };

// The inner content of the chat sidebar — shared verbatim by the fixed desktop
// <aside> and the mobile slide-in drawer (see SidebarDrawer). Server component;
// the interactive bits live in their own client leaves (SidebarTabs, the profile
// bar). The top padding reserves the iOS notch so the logo clears it when the
// drawer opens full-height.
//
// user === null means there's no account yet (the gender gate is up / logged
// out): the sidebar still shows nav + lists behind the gate, but drops the
// Premium upsell and profile bar — there's nothing to upsell or sign out of.
export function ChatSidebar({ user }: { user: SidebarUser | null }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      {/* No logo here — on desktop it lives in the top header bar (see page.tsx);
          the mobile drawer intentionally omits it (the ☰ bar shows context). */}
      <SidebarTabs />

      {user && (
        <>
          {/* Desktop: an orange-tinted upsell card (border + tint + blurb).
              Mobile drawer: strip the box and blurb (md:-only) — just the chip. */}
          <div className="md:rounded-lg md:border md:border-primary/30 md:bg-primary/5 md:p-3">
            <p className="text-balance text-xs leading-snug text-muted-foreground max-md:hidden">
              Gender filters, skip the wait, and no ads.
            </p>
            {/* Neutral chip that flips black/white with the theme, so the orange
                PRO stays legible on either. Text mirrors the wordmark —
                "Chatarooni" in foreground, the suffix in primary (cf.
                Chatarooni<span>.com</span> in BrandMark). bg-transparent +
                hover:bg-transparent drop the Button variant's bg-primary /
                hover:bg-primary so only the gradient paints (the real hover is
                opacity). */}
            <Button
              size="sm"
              className="w-full border border-border bg-transparent bg-linear-to-b from-white to-neutral-100 font-semibold text-foreground shadow-sm transition-opacity hover:bg-transparent hover:opacity-90 md:mt-2.5 dark:from-neutral-900 dark:to-neutral-950"
            >
              <span>
                Get Chatarooni{' '}
                <span className="font-normal text-primary">PRO</span>
              </span>
            </Button>
          </div>

          <SidebarProfile user={user} />
        </>
      )}
    </div>
  );
}
