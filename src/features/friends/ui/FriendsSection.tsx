"use client";

import { useState } from "react";
import { AnimatedList, AnimatedRow, useRollbackShake } from "@/components/motion";
import { Modal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/motion";
import { useFriends, useRemoveFriend, type Friend } from "@/features/friends/hooks";
import { InlineError, RowSkeletons, ROW, UserRowContent } from "./Rows";
import { useRowExit } from "./useRowExit";

export function FriendsSection({ onFindFriend }: { onFindFriend: () => void }) {
  const q = useFriends();
  const friends = q.data ?? [];
  const { modes, setExit, heading } = useRowExit(friends.map((f) => f.id));
  const remove = useRemoveFriend();
  const { shake } = useRollbackShake();
  const [target, setTarget] = useState<Friend | null>(null);

  const confirm = () => {
    if (!target) return;
    const f = target;
    setTarget(null);
    setExit(f.id, "dismiss");
    remove.mutate(f, {
      onError: () => {
        setExit(f.id, undefined);
        shake(f.id);
      },
    });
  };

  return (
    <section aria-labelledby="friends-heading" className="mt-8">
      <h2
        id="friends-heading"
        ref={heading}
        tabIndex={-1}
        className="mb-2 text-base font-semibold text-fg outline-none"
      >
        Friends
      </h2>
      {q.isPending ? (
        <RowSkeletons count={3} />
      ) : q.isError ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <InlineError what="your friends" onRetry={() => void q.refetch()} />
        </div>
      ) : friends.length === 0 ? (
        <EmptyState
          title="Your circle is empty"
          body="Search a friend's exact username to send a request."
          action={
            <Button variant="secondary" onClick={onFindFriend}>
              Find a friend
            </Button>
          }
        />
      ) : (
        <AnimatedList
          as="ul"
          className="overflow-hidden rounded-2xl border border-border bg-surface"
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
