'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

// Mobile-only wrapper: a ☰ button that slides the sidebar in from the left.
// Built on Vaul (not Radix) so the panel is drag-to-dismiss — flick/drag it left
// to close, with the scrim fading as you go; focus trap, Esc, and scroll-lock
// come for free. `children` is the server-rendered <ChatSidebar>, passed through
// so it stays a server component. Hidden at md+ where the sidebar is a permanent
// <aside>.
//
// `banner` true ⇒ the anonymous strip is pinned above the drawer (z-60). pt-4
// drops the drawer's content just below the banner AND centres the Chat/Friends
// toggle on the main "Text Chat" header row (its center = banner-bottom + 1.5rem,
// matched by pt-4 + ChatSidebar's pt + half the toggle). safe-area is already
// paid inside ChatSidebar, so it isn't added here.
export function SidebarDrawer({
  children,
  banner = false,
}: {
  children: ReactNode;
  banner?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // The drawer is a portaled, fixed overlay — md:hidden only hides the trigger,
  // so an open drawer would otherwise linger on top of the permanent <aside>
  // after the viewport grows past md (768px, Tailwind's default). Close it on
  // that crossover. (Controlled open state; Vaul still drives drag/scrim/Esc.)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const close = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener('change', close);
    return () => mq.removeEventListener('change', close);
  }, []);

  return (
    <Drawer
      direction="left"
      open={open}
      onOpenChange={setOpen}
      // Vaul's input repositioning is built for bottom sheets — for a full-height
      // left drawer it shoots the whole panel up when an input (the Friends
      // search) is focused on iOS. Off ⇒ the drawer stays full-length and native
      // scroll keeps the field visible, like the rest of the site.
      repositionInputs={false}
    >
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        aria-describedby={undefined}
        // w-64 matches the desktop <aside> exactly (overrides Vaul's default
        // left width of w-3/4 — same data-variant so tailwind-merge dedupes it).
        className={cn(
          'bg-(--sidebar) data-[vaul-drawer-direction=left]:w-64',
          banner && 'pt-4',
        )}
      >
        <DrawerTitle className="sr-only">Menu</DrawerTitle>
        {children}
      </DrawerContent>
    </Drawer>
  );
}
