"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import type { UserSummary } from "@/features/friends/hooks";

/** One fixed row height shared by real rows, skeletons and the search result. */
export const ROW = "flex h-16 items-center gap-3 px-4";

export function RowSkeleton() {
  return (
    <div className={ROW}>
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1">
        <Skeleton className="h-5 w-32 rounded-md" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
      <Skeleton className="h-10 w-20 shrink-0 rounded-full" />
    </div>
  );
}

export function RowSkeletons({ count }: { count: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-surface"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Avatar, two text lines and a trailing action slot. */
export function UserRowContent({ user, children }: { user: UserSummary; children?: ReactNode }) {
  const name = user.display_name || user.username;
  return (
    <>
      <Avatar src={user.avatar_url} name={name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-5 text-fg">{name}</p>
        <p className="truncate text-xs leading-4 text-fg-muted">@{user.username}</p>
      </div>
      <div className={cn("flex shrink-0 items-center gap-2")}>{children}</div>
    </>
  );
}

export function InlineError({ onRetry, what }: { onRetry: () => void; what: string }) {
  return (
    <div
      role="alert"
      className="flex min-h-16 items-center justify-between gap-3 px-4 py-2 text-sm text-fg-muted"
    >
      <span>Couldn&apos;t load {what} just now. Please try again.</span>
      <Button variant="secondary" size="md" onClick={onRetry} className="shrink-0">
        Retry
      </Button>
    </div>
  );
}
