import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';

export function SiteFooter() {
  return (
    <footer className="select-none border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-between sm:px-6">
        <BrandMark href="/" size="sm" />
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link
            href="/privacy"
            className="transition-colors hover:text-foreground"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="transition-colors hover:text-foreground"
          >
            Terms
          </Link>
        </nav>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Chatarooni. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
