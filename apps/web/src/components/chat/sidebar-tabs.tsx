'use client';

import { useState, type ReactNode } from 'react';
import {
  Inbox,
  MessageSquarePlus,
  MessagesSquare,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Tab = 'chat' | 'friends';

const TAB_BASE =
  'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors';

// Chat / Friends switcher plus the list area beneath it. The active tab is local
// state, so the mobile drawer always reopens on "chat" — a clean, consistent
// reset rather than half-remembering the tab while losing the typed search. Both
// lists are empty placeholders until DMs and friends are wired to the backend.
export function SidebarTabs() {
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1">
        <button
          type="button"
          onClick={() => setTab('chat')}
          aria-pressed={tab === 'chat'}
          className={cn(
            TAB_BASE,
            tab === 'chat'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MessagesSquare className="size-4" />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setTab('friends')}
          aria-pressed={tab === 'friends'}
          className={cn(
            TAB_BASE,
            tab === 'friends'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Users className="size-4" />
          Friends
        </button>
      </div>

      {/* Full-bleed divider under the toggle (-mx-3 cancels ChatSidebar's px-3,
          so it spans edge-to-edge like the header / sidebar borders). */}
      <div className="-mx-3 h-px shrink-0 bg-border" />

      {tab === 'chat' ? (
        <>
          <Button className="w-full justify-start gap-2">
            <MessageSquarePlus className="size-4" />
            New Chat
          </Button>
          <Section title="Direct Messages">
            <EmptyState
              icon={<Inbox className="size-9" strokeWidth={1.5} />}
              title="No messages yet"
              hint="Looks like you're the popular one here."
            />
          </Section>
        </>
      ) : (
        <>
          <div className="relative">
            <Input
              type="search"
              placeholder="Search Friends"
              aria-label="Search friends"
              className="pr-9"
            />
            <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Section title="Friends List">
            <EmptyState
              icon={<UserPlus className="size-9" strokeWidth={1.5} />}
              title="No friends yet"
              hint="People you add will show up here."
            />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center text-muted-foreground/40">
      {icon}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
