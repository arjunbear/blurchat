import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-var(--header-h))] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        404
      </p>
      <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        Page not <span className="text-primary">found</span>
      </h1>
      <p className="mt-4 max-w-md text-balance text-foreground/80">
        That page doesn&apos;t exist yet — we&apos;re still building. Let&apos;s
        get you back home.
      </p>
      <Button asChild size="xl" className="mt-8 font-semibold">
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
