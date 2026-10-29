"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatedList, AnimatedNumber, AnimatedRow, useRollbackShake } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { celebrate, preloadCelebrate } from "@/features/celebrate";
import {
  useAcceptFriendRequest,
  useDismissFriendRequest,
  useFriendRequests,
  type FriendRequest,
} from "@/features/friends/hooks";
import { timing } from "@/motion/tokens";
import { useAnnounce } from "./Announcer";
import { FadeSwap, InlineError, RowSkeletons, ROW, UserRowContent } from "./Rows";
import { useRowExit } from "./useRowExit";

const card = "rounded-2xl border border-border bg-surface";
const rowClass = "border-b border-border last:border-b-0";
const headingFocus =
  "rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function IncomingContent({
  req,
  accepting,
  onAccept,
  onDecline,
}: {
  req: FriendRequest;
  accepting: boolean;
  onAccept: (req: FriendRequest, el: HTMLElement) => void;
  onDecline: (req: FriendRequest) => void;
}) {
  return (
    <UserRowContent user={req}>
      <Button
        variant="ghost"
        onClick={() => onDecline(req)}
        disabled={accepting}
        aria-label={`Decline friend request from @${req.username}`}
      >
        Decline
      </Button>
      <Button
        data-focus-id={req.id}
        state={accepting ? "success" : "idle"}
        onPointerDown={preloadCelebrate}
        onPointerEnter={preloadCelebrate}
        onClick={(e) => onAccept(req, e.currentTarget)}
        aria-label={`Accept friend request from @${req.username}`}
        announce={{ success: "Accepted" }}
      >
        Accept
      </Button>
    </UserRowContent>
  );
}

export function RequestsSection() {
  const q = useFriendRequests();
  const accept = useAcceptFriendRequest();
  const dismiss = useDismissFriendRequest();
  const { shake } = useRollbackShake();
  const announce = useAnnounce();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inflight = useRef(new Set<string>());
  const timers = useRef(new Set<number>());
  const [accepting, setAccepting] = useState<ReadonlySet<string>>(new Set());

  const all = q.data ?? [];
  const incoming = all.filter((r) => r.direction === "incoming");
  const outgoing = all.filter((r) => r.direction === "outgoing");
  const { modes: inModes, setExit: setInExit } = useRowExit(
    incoming.map((r) => r.id),
    headingRef,
  );
  const { modes: outModes, setExit: setOutExit } = useRowExit(
    outgoing.map((r) => r.id),
    headingRef,
  );

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  const setBusyAccepting = (id: string, on: boolean) =>
    setAccepting((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const onAccept = (req: FriendRequest, el: HTMLElement) => {
    if (inflight.current.has(req.id)) return;
    inflight.current.add(req.id);
    setBusyAccepting(req.id, true);
    const r = el.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const handle = window.setTimeout(() => {
      timers.current.delete(handle);
      setInExit(req.id, "collapse");
      accept
        .mutateAsync(req)
        .then(
          (tier) => {
            celebrate({ tier, origin });
            announce(`You and @${req.username} are now friends`);
          },
          () => {
            setBusyAccepting(req.id, false);
            setInExit(req.id, undefined);
            shake(req.id);
            announce(`Couldn't accept @${req.username}. Please try again.`);
          },
        )
        .finally(() => inflight.current.delete(req.id));
    }, timing.acceptHoldMs);
    timers.current.add(handle);
  };

  const onDismiss = (req: FriendRequest) => {
    if (inflight.current.has(req.id)) return;
    inflight.current.add(req.id);
    const incomingReq = req.direction === "incoming";
    const setExit = incomingReq ? setInExit : setOutExit;
    setExit(req.id, "dismiss");
    dismiss
      .mutateAsync(req)
      .then(
        () =>
          announce(
            incomingReq ? `Declined @${req.username}` : `Cancelled request to @${req.username}`,
          ),
        () => {
          setExit(req.id, undefined);
          shake(req.id);
          announce(
            incomingReq
              ? `Couldn't decline @${req.username}. Please try again.`
              : `Couldn't cancel request to @${req.username}. Please try again.`,
          );
        },
      )
      .finally(() => inflight.current.delete(req.id));
  };

  const loaded = !q.isPending && !q.isError;

  return (
    <section aria-labelledby="requests-heading" className="mt-6">
      <h2
        id="requests-heading"
        ref={headingRef}
        tabIndex={-1}
        className={`mb-2 flex items-center gap-2 text-base font-semibold text-fg ${headingFocus}`}
      >
        Requests
        {incoming.length > 0 && (
          <span className="rounded-full bg-surface-2 px-2 text-sm font-medium text-fg-muted">
            <AnimatedNumber value={incoming.length} />
          </span>
        )}
      </h2>
      {q.isPending ? (
        <RowSkeletons count={2} />
      ) : q.isError ? (
        <div className={card}>
          <InlineError what="your requests" onRetry={() => void q.refetch()} />
        </div>
      ) : null}
      {loaded && (
        <>
          <FadeSwap show={all.length === 0}>
            <p className="px-1 text-sm text-fg-muted">No pending requests</p>
          </FadeSwap>
          <AnimatedList
            as="ul"
            aria-labelledby="requests-heading"
            className={incoming.length > 0 ? card : ""}
          >
            {incoming.map((r) => (
              <AnimatedRow
                key={r.id}
                id={r.id}
                exit={inModes[r.id] ?? "dismiss"}
                as="li"
                className={`${ROW} ${rowClass}`}
              >
                <IncomingContent
                  req={r}
                  accepting={accepting.has(r.id)}
                  onAccept={onAccept}
                  onDecline={onDismiss}
                />
              </AnimatedRow>
            ))}
          </AnimatedList>
          <div className={outgoing.length > 0 ? "mt-4" : ""}>
            <FadeSwap show={outgoing.length > 0}>
              <h3
                id="sent-heading"
                className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg-muted"
              >
                Sent
                <AnimatedNumber value={outgoing.length} />
              </h3>
            </FadeSwap>
            <AnimatedList
              as="ul"
              aria-labelledby={outgoing.length > 0 ? "sent-heading" : undefined}
              className={outgoing.length > 0 ? card : ""}
            >
              {outgoing.map((r) => (
                <AnimatedRow
                  key={r.id}
                  id={r.id}
                  exit={outModes[r.id] ?? "dismiss"}
                  as="li"
                  className={`${ROW} ${rowClass}`}
                >
                  <UserRowContent user={r}>
                    <Button
                      data-focus-id={r.id}
                      variant="secondary"
                      aria-label={`Cancel friend request to @${r.username}`}
                      onClick={() => onDismiss(r)}
                    >
                      Cancel
                    </Button>
                  </UserRowContent>
                </AnimatedRow>
              ))}
            </AnimatedList>
          </div>
        </>
      )}
    </section>
  );
}
