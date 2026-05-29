import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Home hero CTA → /chat. The /chat gate owns bootstrap (gender + anon
// creation), so this is just a styled link.
export function StartChattingButton() {
  return (
    <Button asChild size="xl" className="mt-10 font-semibold">
      <Link href="/chat">
        <span className="relative flex size-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-75" />
          <span className="relative inline-flex size-2.5 items-center justify-center rounded-full bg-primary-foreground">
            <span className="size-1.5 rounded-full bg-emerald-400" />
          </span>
        </span>
        Start chatting
      </Link>
    </Button>
  );
}
