import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-6xl flex-col items-center justify-center px-4 text-center sm:px-6">
      <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-7xl">
        Talk to <span className="text-primary">strangers</span>
      </h1>
      <p className="mt-6 max-w-md text-balance text-lg text-muted-foreground">
        Free random text chat. Meet new people from around the world — no sign-up
        required.
      </p>
      <Button asChild size="xl" className="mt-10 font-semibold">
        <Link href="/chat">Start chatting</Link>
      </Button>
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary/70" aria-hidden="true" />
        Video chat — coming soon
      </div>
    </main>
  );
}
