"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge, PressableScale } from "@/components/motion";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useIncomingRequestCount } from "@/features/friends/hooks";
import { cn } from "@/lib/cn";

function PeopleIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18 14.3c2.3.7 3.5 2.6 3.5 5.7" />
    </svg>
  );
}

/** Temporary header until the M5 tab bar. */
export function TopNav() {
  const pathname = usePathname();
  const count = useIncomingRequestCount();
  const onFriends = pathname.startsWith("/friends");
  const onFeed = pathname.startsWith("/feed");
  const link =
    "inline-flex h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4"
      >
        <PressableScale
          as={Link}
          href="/feed"
          aria-current={onFeed ? "page" : undefined}
          className={cn(link, "gap-2 pr-2")}
        >
          <Logo size={32} />
          <span className="text-lg font-semibold text-fg">Circle</span>
        </PressableScale>
        <div className="flex items-center gap-1">
          <PressableScale
            as={Link}
            href="/friends"
            aria-current={onFriends ? "page" : undefined}
            aria-label={
              count > 0
                ? `Friends, ${count} pending ${count === 1 ? "request" : "requests"}`
                : "Friends"
            }
            className={cn(
              link,
              "relative w-11 justify-center",
              onFriends ? "text-accent" : "text-fg-muted",
            )}
          >
            <PeopleIcon />
            <span className="pointer-events-none absolute right-0 top-0">
              <Badge count={count} />
            </span>
          </PressableScale>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
