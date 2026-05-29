import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Full-width notice strip shown above the app surface for anonymous accounts.
// Nudges the guest to claim a real account before their data is lost on logout.
// "Claim account" → /login?intent=claim, which puts the form in claim mode
// (linkSocial): it upgrades this guest in place, or errors WITHOUT signing in
// if the chosen provider account already belongs to someone else.
export function AnonymousBanner() {
  return (
    <div className="flex w-full items-center justify-center gap-3 bg-primary px-3 pb-1 pt-[calc(0.25rem+env(safe-area-inset-top))] text-sm font-medium text-primary-foreground">
      <span className="min-w-0 truncate">You&apos;re anonymous</span>
      <Button
        asChild
        size="xs"
        variant="secondary"
        className="shrink-0 shadow-sm"
      >
        <Link href="/login?intent=claim">Claim account</Link>
      </Button>
    </div>
  );
}
