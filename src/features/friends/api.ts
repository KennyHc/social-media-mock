import { supabaseBrowser } from "@/lib/supabase/client";

export type Relationship = "self" | "friends" | "outgoing" | "incoming" | "none";

export type UserSummary = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type SearchResult = UserSummary & { relationship: Relationship };
export type Friend = UserSummary & { since: string };
export type FriendRequest = UserSummary & {
  request_id: string;
  direction: "incoming" | "outgoing";
  created_at: string;
};

const rpc = () => supabaseBrowser();

/** Exact, case-insensitive username lookup. Returns null when nobody matches. */
export async function findUser(username: string): Promise<SearchResult | null> {
  const { data, error } = await rpc().rpc("find_user_by_username", { name: username });
  if (error) throw error;
  const row = data?.[0];
  return row ? { ...row, relationship: row.relationship as Relationship } : null;
}

export async function listFriends(): Promise<Friend[]> {
  const { data, error } = await rpc().rpc("list_friends");
  if (error) throw error;
  return data ?? [];
}

export async function listFriendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await rpc().rpc("list_friend_requests");
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, direction: r.direction as FriendRequest["direction"] }));
}

/** Returns the resulting status: "accepted" when the other person had already asked us. */
export async function sendFriendRequest(target: string) {
  const { data, error } = await rpc().rpc("send_friend_request", { target });
  if (error) throw error;
  return data as { id: string; status: "pending" | "accepted" };
}

export async function respondFriendRequest(requestId: string, accept: boolean) {
  const { error } = await rpc().rpc("respond_friend_request", {
    request_id: requestId,
    accept,
  });
  if (error) throw error;
}

/** Unfriend, cancel an outgoing request or decline an incoming one. */
export async function removeFriendship(other: string) {
  const { error } = await rpc().rpc("remove_friendship", { other });
  if (error) throw error;
}
