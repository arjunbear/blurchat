import { ModeToggle } from '@/components/mode-toggle';
import { UserMenu } from '@/components/user-menu';
import { BrandMark } from '@/components/brand-mark';
import { getSession } from '@/lib/auth-session';

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-50 w-full select-none border-b border-border/60 bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-(--header-h) max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark href="/" size="responsive" priority />
        <div className="flex items-center gap-2">
          <ModeToggle />
          {/* No logged-out "Log in" button — login lives in the /chat gate. */}
          {session?.user && (
            <UserMenu user={{ displayName: session.user.displayName }} />
          )}
        </div>
      </div>
    </header>
  );
}
