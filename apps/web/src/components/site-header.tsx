import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-[var(--header-h)] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-3xl font-bold tracking-tight"
        >
          <Image
            src="/logo.png"
            alt=""
            width={64}
            height={64}
            className="size-16"
            priority
          />
          <span>
            Chatarooni<span className="font-normal text-primary">.com</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
