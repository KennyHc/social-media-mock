"use client";

import { useRef, useState } from "react";
import {
  AnimatedList,
  AnimatedRow,
  Modal,
  PressableScale,
  useRollbackShake,
} from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  useFriendRequests,
  useFriends,
  useRemoveFriend,
  type Friend,
} from "@/features/friends/hooks";
import { useAnnounce } from "./Announcer";
import { FadeSwap, InlineError, ROW, RowSkeletons, UserRowContent } from "./Rows";
import { useRowExit } from "./useRowExit";

export function FriendsSection({ onFindFriend }: { onFindFriend: () => void }) {
  const q = useFriends();
  const requests = useFriendRequests();
  const friends = q.data ?? [];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { modes, setExit } = useRowExit(
    friends.map((f) => f.id),
    headingRef,
  );
  const remove = useRemoveFriend();
  const { shake } = useRollbackShake();
  const announce = useAnnounce();
  const inflight = useRef(new Set<string>());
  const [target, setTarget] = useState<Friend | null>(null);

  // Hold this whole section until the requests block has settled so nothing below it shifts.
  if (requests.isPending) return null;

  const confirm = () => {
    if (!target) return;
    const f = target;
    setTarget(null);
    if (inflight.current.has(f.id)) return;
    inflight.current.add(f.id);
    setExit(f.id, "dismiss");
    remove
      .mutateAsync(f)
      .then(
        () => announce(`Removed @${f.username}`),
        () => {
          setExit(f.id, undefined);
          shake(f.id);
          announce(`Couldn't remove @${f.username}. Please try again.`);
        },
      )
      .finally(() => inflight.current.delete(f.id));
  };

  const loaded = !q.isPending && !q.isError;

  return (
    <section aria-labelledby="friends-heading" className="mt-8">
      <h2
        id="friends-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mb-2 rounded-md text-base font-semibold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Friends
      </h2>
      {q.isPending ? (
        <RowSkeletons count={3} />
      ) : q.isError ? (
        <div className="rounded-2xl border border-border bg-surface">
          <InlineError what="your friends" onRetry={() => void q.refetch()} />
        </div>
      ) : null}
      {loaded && (
        <>
          <FadeSwap show={friends.length === 0}>
            <EmptyState
              title="Your circle is empty"
              body="Search a friend's exact username to send a request."
              action={
                <Button variant="secondary" onClick={onFindFriend}>
                  Find a friend
                </Button>
              }
            />
          </FadeSwap>
          <AnimatedList
            as="ul"
            aria-labelledby="friends-heading"
            className={friends.length > 0 ? "rounded-2xl border border-border bg-surface" : ""}
          >
            {friends.map((f) => (
              <AnimatedRow
                key={f.id}
                id={f.id}
                exit={modes[f.id] ?? "dismiss"}
                as="li"
                className={`${ROW} border-b border-border last:border-b-0`}
              >
                <UserRowContent user={f}>
                  <PressableScale
                    data-focus-id={f.id}
                    aria-label={`More options for @${f.username}`}
                    aria-haspopup="dialog"
                    onClick={() => setTarget(f)}
                    className="grid h-10 w-10 place-items-center rounded-full text-lg text-fg-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span aria-hidden="true">⋯</span>
                  </PressableScale>
                </UserRowContent>
              </AnimatedRow>
            ))}
          </AnimatedList>
        </>
      )}
      <Modal
        open={target !== null}
        onOpenChange={(o) => {
          if (!o) setTarget(null);
        }}
        title={target ? `Remove @${target.username}?` : "Remove friend?"}
      >
        <p className="mt-2 text-sm text-fg-muted">
          They won&apos;t see your posts and you won&apos;t see theirs.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm}>
            Remove
          </Button>
        </div>
      </Modal>
    </section>
  );
}
