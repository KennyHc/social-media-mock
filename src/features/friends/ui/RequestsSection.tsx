"use client";

import { useRef, useState } from "react";
import { AnimatedList, AnimatedRow, AnimatedNumber, useRollbackShake } from "@/components/motion";
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
import { InlineError, RowSkeletons, ROW, UserRowContent } from "./Rows";
import { useRowExit, type ExitMode } from "./useRowExit";

const listClass = "overflow-hidden rounded-2xl border border-border bg-surface";
const rowClass = "border-b border-border last:border-b-0";

function IncomingContent({
  req,
  setExit,
}: {
  req: FriendRequest;
  setExit: (id: string, mode: ExitMode | undefined) => void;
}) {
  const accept = useAcceptFriendRequest();
  const decline = useDismissFriendRequest();
  const { shake } = useRollbackShake();
  const announce = useAnnounce();
  const [accepting, setAccepting] = useState(false);
  const busy = useRef(false);

  const onAccept = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (busy.current) return;
    busy.current = true;
    setAccepting(true);
    const r = e.currentTarget.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    window.setTimeout(() => {
      setExit(req.id, "collapse");
      accept.mutateAsync(req).then(
        (tier) => {
          celebrate({ tier, origin });
          announce(`You and @${req.username} are now friends`);
        },
        () => {
          busy.current = false;
          setAccepting(false);
          setExit(req.id, undefined);
          shake(req.id);
        },
      );
    }, timing.acceptHoldMs);
  };

  const onDecline = () => {
    setExit(req.id, "dismiss");
    decline.mutate(req, {
      onError: () => {
        setExit(req.id, undefined);
        shake(req.id);
      },
    });
  };

  return (
    <UserRowContent user={req}>
      <Button
        variant="ghost"
        onClick={onDecline}
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
        onClick={onAccept}
        aria-label={`Accept friend request from @${req.username}`}
        announce={{ success: "Accepted" }}
      >
        Accept
      </Button>
    </UserRowContent>
  );
}

function OutgoingContent({
  req,
  setExit,
}: {
  req: FriendRequest;
  setExit: (id: string, mode: ExitMode | undefined) => void;
}) {
  const cancel = useDismissFriendRequest();
  const { shake } = useRollbackShake();
  return (
    <UserRowContent user={req}>
      <Button
        data-focus-id={req.id}
        variant="secondary"
        aria-label={`Cancel friend request to @${req.username}`}
        onClick={() => {
          setExit(req.id, "dismiss");
          cancel.mutate(req, {
            onError: () => {
              setExit(req.id, undefined);
              shake(req.id);
            },
          });
        }}
      >
        Cancel
      </Button>
    </UserRowContent>
  );
}

export function RequestsSection() {
  const q = useFriendRequests();
  const all = q.data ?? [];
  const incoming = all.filter((r) => r.direction === "incoming");
  const outgoing = all.filter((r) => r.direction === "outgoing");
  const {
    modes: inModes,
    setExit: setInExit,
    heading: inHeading,
  } = useRowExit(incoming.map((r) => r.id));
  const {
    modes: outModes,
    setExit: setOutExit,
    heading: outHeading,
  } = useRowExit(outgoing.map((r) => r.id));

  return (
    <section aria-labelledby="requests-heading" className="mt-6">
      <h2
        id="requests-heading"
        ref={inHeading}
        tabIndex={-1}
        className="mb-2 flex items-center gap-2 text-base font-semibold text-fg outline-none"
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
        <div className={listClass}>
          <InlineError what="your requests" onRetry={() => void q.refetch()} />
        </div>
      ) : (
        <>
          {all.length === 0 && <p className="px-1 text-sm text-fg-muted">No pending requests</p>}
          {incoming.length > 0 && (
            <AnimatedList as="ul" className={listClass}>
              {incoming.map((r) => (
                <AnimatedRow
                  key={r.id}
                  id={r.id}
                  exit={inModes[r.id] ?? "dismiss"}
                  as="li"
                  className={`${ROW} ${rowClass}`}
                >
                  <IncomingContent req={r} setExit={setInExit} />
                </AnimatedRow>
              ))}
            </AnimatedList>
          )}
          {outgoing.length > 0 && (
            <div className="mt-4">
              <h3
                id="sent-heading"
                ref={outHeading}
                tabIndex={-1}
                className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg-muted outline-none"
              >
                Sent
                <AnimatedNumber value={outgoing.length} />
              </h3>
              <AnimatedList as="ul" aria-labelledby="sent-heading" className={listClass}>
                {outgoing.map((r) => (
                  <AnimatedRow
                    key={r.id}
                    id={r.id}
                    exit={outModes[r.id] ?? "dismiss"}
                    as="li"
                    className={`${ROW} ${rowClass}`}
                  >
                    <OutgoingContent req={r} setExit={setOutExit} />
                  </AnimatedRow>
                ))}
              </AnimatedList>
            </div>
          )}
        </>
      )}
    </section>
  );
}
