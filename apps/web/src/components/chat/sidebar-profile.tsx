'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Ellipsis,
  Fingerprint,
  LogOut,
  Moon,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SidebarUser = { displayName?: string | null; isAnonymous: boolean };

// Bottom-of-sidebar profile bar (Chitchat-style): three borderless buttons —
// avatar+name (no-op for now), a settings cog (no-op for now), and a ⋯ that
// opens an upward menu (dark-mode toggle, claim shortcut for guests, logout).
// The display name is a publicId for guests until they claim/rename.
export function SidebarProfile({ user }: { user: SidebarUser }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const name = user.displayName ?? 'Guest';
  // Plan tier — everyone is "Free" until the PRO upgrade ships.
  const subtitle = 'Free';

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    // -mx-3 + px-3 makes the top divider full-bleed (cancels ChatSidebar's px-3),
    // matching the header / sidebar borders.
    <div className="-mx-3 flex items-center gap-1 border-t border-border px-3 pt-3">
      {/* avatar + name + tier — one button (does nothing yet). */}
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-accent"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <UserRound className="size-5" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        </span>
      </button>

      {/* settings cog — one button (does nothing yet). */}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Settings"
        className="shrink-0 text-muted-foreground"
      >
        <Settings className="size-4" />
      </Button>

      {/* ⋯ — opens the account menu upward. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Account menu"
            className="shrink-0 text-muted-foreground"
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')}>
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </DropdownMenuItem>
          {user.isAnonymous && (
            <DropdownMenuItem asChild>
              <Link href="/login?intent=claim">
                <Fingerprint className="size-4" />
                Claim account
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
