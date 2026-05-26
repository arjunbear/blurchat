import Link from 'next/link';
import Image from 'next/image';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium"
        >
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="size-6"
          />
          <span>
            Chatarooni<span className="font-normal text-primary">.com</span>
          </span>
        </Link>
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
          © {new Date().getFullYear()} Chatarooni
        </p>
      </div>
    </footer>
  );
}
