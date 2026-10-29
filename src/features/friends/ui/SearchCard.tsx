"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type FormEvent, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { celebrate, preloadCelebrate } from "@/features/celebrate";
import {
  useDismissFriendRequest,
  useFriendRequests,
  useSendFriendRequest,
  useUserSearch,
  type SearchResult,
} from "@/features/friends/hooks";
import { usernameSchema } from "@/lib/validation";
import { enter, exitT } from "@/motion/tokens";
import { useAnnounce } from "./Announcer";
import { ROW, RowSkeleton, UserRowContent } from "./Rows";

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: enter },
  exit: { opacity: 0, transition: exitT },
};

function ResultActions({ user }: { user: SearchResult }) {
  const send = useSendFriendRequest();
  const cancel = useDismissFriendRequest();
  const requests = useFriendRequests();
  const announce = useAnnounce();
  const box = useRef<HTMLSpanElement>(null);

  const centre = () => {
    const r = box.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined;
  };

  switch (user.relationship) {
    case "self":
      return <span className="text-sm text-fg-muted">That&apos;s you</span>;
    case "friends":
      return <span className="text-sm text-fg-muted">Friends ✓</span>;
    case "incoming":
      return (
        <span ref={box}>
          <Button
            aria-label={`Accept friend request from @${user.username}`}
            onPointerDown={preloadCelebrate}
            onPointerEnter={preloadCelebrate}
            onClickAsync={async () => {
              const origin = centre();
              const tier = await send.mutateAsync(user);
              if (tier) celebrate({ tier, origin });
              announce(`You and @${user.username} are now friends`);
            }}
          >
            Accept
          </Button>
        </span>
      );
    default: {
      // "none" and "outgoing" share one Button so loading -> check -> "Requested" never remounts.
      const outgoing = user.relationship === "outgoing";
      return (
        <span ref={box}>
          <Button
            variant={outgoing ? "secondary" : "primary"}
            aria-label={
              outgoing ? `Cancel friend request to @${user.username}` : `Add @${user.username}`
            }
            onPointerDown={outgoing ? undefined : preloadCelebrate}
            onClickAsync={async () => {
              if (outgoing) {
                const req = requests.data?.find(
                  (r) => r.id === user.id && r.direction === "outgoing",
                );
                await cancel.mutateAsync(
                  req ?? { ...user, request_id: "", direction: "outgoing", created_at: "" },
                );
                return;
              }
              const origin = centre();
              const tier = await send.mutateAsync(user);
              if (tier) {
                celebrate({ tier, origin });
                announce(`You and @${user.username} are now friends`);
              } else {
                announce("Request sent");
              }
            }}
          >
            {outgoing ? "Requested" : "Add"}
          </Button>
        </span>
      );
    }
  }
}

export function SearchCard({ inputRef }: { inputRef?: Ref<HTMLInputElement> }) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const search = useUserSearch(submitted);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = usernameSchema.safeParse(value);
    if (!parsed.success) {
      setHint(parsed.error.issues[0]?.message ?? "Enter a valid username");
      return;
    }
    setHint(null);
    setSubmitted(parsed.data);
  };

  let key: string;
  let body;
  if (!submitted) {
    key = "idle";
    body = (
      <p className="px-4 text-sm text-fg-muted">
        Look someone up to send a request.
      </p>
    );
  } else if (search.isPending || (search.isFetching && !search.data && !search.isError)) {
    key = "loading";
    body = <RowSkeleton />;
  } else if (search.isError) {
    key = "error";
    body = (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 px-4 text-sm text-fg-muted"
      >
        <span>Couldn&apos;t search just now. Please try again.</span>
        <Button variant="secondary" onClick={() => void search.refetch()} className="shrink-0">
          Retry
        </Button>
      </div>
    );
  } else if (!search.data) {
    key = "none";
    body = <p className="px-4 text-sm text-fg-muted">No one with that username</p>;
  } else {
    key = `result-${search.data.id}`;
    const user = search.data;
    body = (
      <div className={ROW}>
        <UserRowContent user={user}>
          <ResultActions user={user} />
        </UserRowContent>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="search-heading"
      className="rounded-2xl border border-border bg-surface py-4"
    >
      <h2 id="search-heading" className="sr-only">
        Find a friend
      </h2>
      <form onSubmit={onSubmit} className="flex items-start gap-2 px-4" noValidate>
        <Input
          id="friend-search"
          ref={inputRef}
          label="Search by exact username"
          prefix="@"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/^@+/, "").replace(/\s+/g, "").toLowerCase());
            setHint(null);
          }}
          invalid={hint !== null}
          aria-describedby="friend-search-help"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="username"
          wrapperClassName="min-w-0 flex-1"
        />
        <Button type="submit" size="lg" className="mt-[1.625rem] shrink-0">
          Find
        </Button>
      </form>
      <p
        id="friend-search-help"
        aria-live="polite"
        className={`mt-1.5 min-h-4 px-4 text-xs leading-4 ${hint ? "text-danger" : "text-fg-muted"}`}
      >
        {hint ?? "Search by exact username"}
      </p>
      <div className="relative mt-3 flex min-h-16 flex-col justify-center" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={key} {...fade}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
