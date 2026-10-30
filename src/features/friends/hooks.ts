"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/motion";
import { messageFor } from "@/features/auth/api";
import { qk } from "@/lib/query/keys";
import { usernameSchema } from "@/lib/validation";
import {
  findUser,
  listFriendRequests,
  listFriends,
  removeFriendship,
  respondFriendRequest,
  sendFriendRequest,
  type Friend,
  type FriendRequest,
  type Relationship,
  type SearchResult,
  type UserSummary,
} from "./api";

export type { Friend, FriendRequest, Relationship, SearchResult, UserSummary };

/** Celebration size for a newly made friendship: the very first friend gets the big one. */
export type CelebrationTier = "small" | "large";

// --- queries ---------------------------------------------------------------

/**
 * Looks up an exact username once `submitted` is a valid username.
 * `data` is null when no one matches.
 */
export function useUserSearch(submitted: string) {
  const parsed = usernameSchema.safeParse(submitted);
  const name = parsed.success ? parsed.data : "";
  return useQuery({
    queryKey: qk.userSearch(name),
    enabled: name.length > 0,
    staleTime: 15_000,
    queryFn: () => findUser(name),
  });
}

export function useFriends() {
  return useQuery({ queryKey: qk.friends(), queryFn: listFriends });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: qk.friendRequests(),
    queryFn: listFriendRequests,
    refetchInterval: 60_000,
  });
}

/** Number of incoming requests, for the nav badge. */
export function useIncomingRequestCount() {
  const { data } = useFriendRequests();
  return data?.filter((r) => r.direction === "incoming").length ?? 0;
}

// --- optimistic cache helpers ------------------------------------------------

type Snapshot = {
  friends?: Friend[];
  requests?: FriendRequest[];
  searches: Array<[readonly unknown[], SearchResult | null | undefined]>;
};

async function snapshot(qc: QueryClient): Promise<Snapshot> {
  await Promise.all([
    qc.cancelQueries({ queryKey: qk.friends() }),
    qc.cancelQueries({ queryKey: qk.friendRequests() }),
    qc.cancelQueries({ queryKey: ["user-search"] }),
  ]);
  return {
    friends: qc.getQueryData<Friend[]>(qk.friends()),
    requests: qc.getQueryData<FriendRequest[]>(qk.friendRequests()),
    searches: qc.getQueriesData<SearchResult | null>({ queryKey: ["user-search"] }),
  };
}

function restore(qc: QueryClient, s: Snapshot | undefined) {
  if (!s) return;
  qc.setQueryData(qk.friends(), s.friends);
  qc.setQueryData(qk.friendRequests(), s.requests);
  s.searches.forEach(([key, value]) => qc.setQueryData(key, value));
}

function setRelationship(qc: QueryClient, userId: string, relationship: Relationship) {
  qc.setQueriesData<SearchResult | null>({ queryKey: ["user-search"] }, (r) =>
    r && r.id === userId ? { ...r, relationship } : r,
  );
}

const dropRequest = (qc: QueryClient, userId: string) =>
  qc.setQueryData<FriendRequest[]>(qk.friendRequests(), (rs) => rs?.filter((r) => r.id !== userId));

const addFriend = (qc: QueryClient, user: UserSummary) =>
  qc.setQueryData<Friend[]>(qk.friends(), (fs) =>
    fs?.some((f) => f.id === user.id)
      ? fs
      : [{ ...user, since: new Date().toISOString() }, ...(fs ?? [])],
  );

// onMutate runs before mutationFn, so the optimistic friend is already cached:
// exclude them when deciding whether this is the first friend.
const hasOtherFriends = (qc: QueryClient, userId: string) =>
  (qc.getQueryData<Friend[]>(qk.friends()) ?? []).some((f) => f.id !== userId);

function settle(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.friends() }),
    qc.invalidateQueries({ queryKey: qk.friendRequests() }),
    qc.invalidateQueries({ queryKey: ["user-search"] }),
    // Friendship changes what the feed may show.
    qc.invalidateQueries({ queryKey: qk.feed() }),
  ]);
}

const errorToast = (e: unknown) => toast.error(messageFor(e as { message?: string }));

// --- mutations ---------------------------------------------------------------
// Each mutation updates the cache immediately, rolls back on error (the UI
// animates the row back in and should shake it via mutate's onError), and
// revalidates on settle. Callers handle celebrations using the returned tier.

/**
 * Send a request to a search result. If they had already asked us, the server
 * auto-accepts: resolves to the celebration tier in that case, else null.
 */
export function useSendFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (user: UserSummary & { relationship?: Relationship }) => {
      const hadFriends = hasOtherFriends(qc, user.id);
      const res = await sendFriendRequest(user.id);
      return res.status === "accepted"
        ? ((hadFriends ? "small" : "large") as CelebrationTier)
        : null;
    },
    onMutate: async (user) => {
      const s = await snapshot(qc);
      if (user.relationship === "incoming") {
        setRelationship(qc, user.id, "friends");
        dropRequest(qc, user.id);
        addFriend(qc, {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        });
        return s;
      }
      setRelationship(qc, user.id, "outgoing");
      qc.setQueryData<FriendRequest[]>(qk.friendRequests(), (rs) => [
        {
          ...user,
          request_id: `optimistic-${user.id}`,
          direction: "outgoing",
          created_at: new Date().toISOString(),
        },
        ...(rs ?? []),
      ]);
      return s;
    },
    onSuccess: (tier, user) => {
      if (tier) {
        setRelationship(qc, user.id, "friends");
        dropRequest(qc, user.id);
        addFriend(qc, {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        });
      }
    },
    onError: (e, _user, s) => {
      restore(qc, s);
      errorToast(e);
    },
    onSettled: () => settle(qc),
  });
}

/** Accept an incoming request. Resolves to the celebration tier. */
export function useAcceptFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: FriendRequest): Promise<CelebrationTier> => {
      const hadFriends = hasOtherFriends(qc, req.id);
      await respondFriendRequest(req.request_id, true);
      return hadFriends ? "small" : "large";
    },
    onMutate: async (req) => {
      const s = await snapshot(qc);
      dropRequest(qc, req.id);
      addFriend(qc, {
        id: req.id,
        username: req.username,
        display_name: req.display_name,
        avatar_url: req.avatar_url,
      });
      setRelationship(qc, req.id, "friends");
      return s;
    },
    onError: (e, _req, s) => {
      restore(qc, s);
      errorToast(e);
    },
    onSettled: () => settle(qc),
  });
}

/** Decline an incoming request, or cancel an outgoing one. */
export function useDismissFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: FriendRequest) =>
      req.direction === "incoming"
        ? respondFriendRequest(req.request_id, false)
        : removeFriendship(req.id),
    onMutate: async (req) => {
      const s = await snapshot(qc);
      dropRequest(qc, req.id);
      setRelationship(qc, req.id, "none");
      return s;
    },
    onError: (e, _req, s) => {
      restore(qc, s);
      errorToast(e);
    },
    onSettled: () => settle(qc),
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friend: UserSummary) => removeFriendship(friend.id),
    onMutate: async (friend) => {
      const s = await snapshot(qc);
      qc.setQueryData<Friend[]>(qk.friends(), (fs) => fs?.filter((f) => f.id !== friend.id));
      setRelationship(qc, friend.id, "none");
      return s;
    },
    onError: (e, _f, s) => {
      restore(qc, s);
      errorToast(e);
    },
    onSettled: () => settle(qc),
  });
}
