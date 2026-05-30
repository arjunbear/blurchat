'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronsUpDown, Fingerprint, LogOut, UserRound } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SidebarUser = { displayName?: string | null; isAnonymous: boolean };

// Bottom-of-sidebar profile bar. Shows the display name (a publicId for guests
// until they claim/rename), with a claim shortcut for anonymous accounts. The
// menu opens upward (side="top") since the bar is pinned to the bottom.
export function SidebarProfile({ user }: { user: SidebarUser }) {
  const router = useRouter();
  const name = user.displayName ?? 'Guest';
  const subtitle = user.isAnonymous ? 'Tap to claim your account' : 'Online';

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-background/60 p-2 text-left transition-colors hover:bg-accent"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserRound className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate font-normal">
          {name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.isAnonymous && (
          <DropdownMenuItem asChild>
            <Link href="/login?intent=claim">
              <Fingerprint className="size-4" />
              Claim account
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
