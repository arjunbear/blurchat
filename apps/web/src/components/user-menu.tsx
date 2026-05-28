'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type User = {
  displayName?: string | null;
};

export function UserMenu({ user }: { user: User }) {
  const router = useRouter();

  const label = user.displayName ?? 'Account';

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Icon-only on phones (the displayName is a long publicId for now);
            name reveals at sm+ where there's room. Full name always in the
            dropdown below. */}
        <Button variant="outline" size="lg">
          <UserRound className="size-4" />
          <span className="hidden max-w-32 truncate sm:inline">{label}</span>
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user.displayName && (
          <>
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium leading-none">
                {user.displayName}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
