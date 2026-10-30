// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { qk } from "@/lib/query/keys";
import type { Friend, FriendRequest, SearchResult } from "@/features/friends/api";

vi.mock("@/components/motion", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/features/friends/api", () => ({
  findUser: vi.fn(),
  listFriends: vi.fn(),
  listFriendRequests: vi.fn(),
  sendFriendRequest: vi.fn(),
  respondFriendRequest: vi.fn(),
  removeFriendship: vi.fn(),
}));

const api = await import("@/features/friends/api");
const { toast } = await import("@/components/motion");
const hooks = await import("@/features/friends/hooks");

const bob = { id: "b", username: "bob", display_name: "Bob", avatar_url: null };
const incoming: FriendRequest = {
  ...bob,
  request_id: "r1",
  direction: "incoming",
  created_at: "2026-10-29T00:00:00.000Z",
};

function setup(seed: { friends?: Friend[]; requests?: FriendRequest[]; search?: SearchResult }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  qc.setQueryData(qk.friends(), seed.friends ?? []);
  qc.setQueryData(qk.friendRequests(), seed.requests ?? []);
  if (seed.search) qc.setQueryData(qk.userSearch(seed.search.username), seed.search);
  // Revalidation after settle returns the server's view; keep it equal to the optimistic one.
  vi.mocked(api.listFriends).mockImplementation(async () => qc.getQueryData(qk.friends()) ?? []);
  vi.mocked(api.listFriendRequests).mockImplementation(
    async () => qc.getQueryData(qk.friendRequests()) ?? [],
  );
  vi.mocked(api.findUser).mockImplementation(
    async (n) => qc.getQueryData(qk.userSearch(n)) ?? null,
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => vi.clearAllMocks());

describe("useAcceptFriendRequest", () => {
  it("moves the request into friends immediately and returns the large tier for a first friend", async () => {
    const { qc, wrapper } = setup({ requests: [incoming] });
    let release!: () => void;
    vi.mocked(api.respondFriendRequest).mockImplementation(
      () => new Promise<void>((r) => (release = r)),
    );
    const { result } = renderHook(() => hooks.useAcceptFriendRequest(), { wrapper });

    let tier: Promise<string>;
    act(() => {
      tier = result.current.mutateAsync(incoming);
    });
    await waitFor(() => expect(qc.getQueryData<Friend[]>(qk.friends())).toHaveLength(1));
    expect(qc.getQueryData<FriendRequest[]>(qk.friendRequests())).toEqual([]);

    release();
    await expect(tier!).resolves.toBe("large");
    expect(api.respondFriendRequest).toHaveBeenCalledWith("r1", true);
  });

  it("returns the small tier when you already have friends", async () => {
    const carol: Friend = { id: "c", username: "carol", display_name: null, avatar_url: null, since: "x" };
    const { wrapper } = setup({ friends: [carol], requests: [incoming] });
    vi.mocked(api.respondFriendRequest).mockResolvedValue();
    const { result } = renderHook(() => hooks.useAcceptFriendRequest(), { wrapper });
    await expect(result.current.mutateAsync(incoming)).resolves.toBe("small");
  });

  it("rolls back and shows an error toast when the server rejects", async () => {
    const { qc, wrapper } = setup({ requests: [incoming] });
    vi.mocked(api.respondFriendRequest).mockRejectedValue(new Error("not_found"));
    const { result } = renderHook(() => hooks.useAcceptFriendRequest(), { wrapper });

    await act(() => result.current.mutateAsync(incoming).catch(() => {}));
    expect(qc.getQueryData<FriendRequest[]>(qk.friendRequests())).toEqual([incoming]);
    expect(qc.getQueryData<Friend[]>(qk.friends())).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith("We couldn't find that user.");
  });
});

describe("useSendFriendRequest", () => {
  it("marks the search result outgoing and adds a sent request", async () => {
    const search: SearchResult = { ...bob, relationship: "none" };
    const { qc, wrapper } = setup({ search });
    vi.mocked(api.sendFriendRequest).mockResolvedValue({ id: "r2", status: "pending" });
    const { result } = renderHook(() => hooks.useSendFriendRequest(), { wrapper });

    await act(() => result.current.mutateAsync(search));
    expect(qc.getQueryData<SearchResult>(qk.userSearch("bob"))?.relationship).toBe("outgoing");
    expect(qc.getQueryData<FriendRequest[]>(qk.friendRequests())?.[0]).toMatchObject({
      id: "b",
      direction: "outgoing",
    });
  });

  it("treats a reverse request as an accept and returns a tier", async () => {
    const search: SearchResult = { ...bob, relationship: "incoming" };
    const { qc, wrapper } = setup({ search, requests: [incoming] });
    vi.mocked(api.sendFriendRequest).mockResolvedValue({ id: "r1", status: "accepted" });
    const { result } = renderHook(() => hooks.useSendFriendRequest(), { wrapper });

    await expect(result.current.mutateAsync(search)).resolves.toBe("large");
    expect(qc.getQueryData<SearchResult>(qk.userSearch("bob"))?.relationship).toBe("friends");
    expect(qc.getQueryData<Friend[]>(qk.friends())?.map((f) => f.id)).toEqual(["b"]);
    expect(qc.getQueryData<FriendRequest[]>(qk.friendRequests())).toEqual([]);
  });
});

describe("useDismissFriendRequest / useRemoveFriend", () => {
  it("declines incoming via respond(false) and cancels outgoing via remove", async () => {
    const outgoing: FriendRequest = { ...incoming, id: "d", username: "dan", request_id: "r3", direction: "outgoing" };
    const { qc, wrapper } = setup({ requests: [incoming, outgoing] });
    vi.mocked(api.respondFriendRequest).mockResolvedValue();
    vi.mocked(api.removeFriendship).mockResolvedValue();
    const { result } = renderHook(() => hooks.useDismissFriendRequest(), { wrapper });

    await act(() => result.current.mutateAsync(incoming));
    await act(() => result.current.mutateAsync(outgoing));
    expect(api.respondFriendRequest).toHaveBeenCalledWith("r1", false);
    expect(api.removeFriendship).toHaveBeenCalledWith("d");
    expect(qc.getQueryData<FriendRequest[]>(qk.friendRequests())).toEqual([]);
  });

  it("restores a removed friend on failure", async () => {
    const friend: Friend = { ...bob, since: "x" };
    const { qc, wrapper } = setup({ friends: [friend] });
    vi.mocked(api.removeFriendship).mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => hooks.useRemoveFriend(), { wrapper });

    await act(() => result.current.mutateAsync(friend).catch(() => {}));
    expect(qc.getQueryData<Friend[]>(qk.friends())).toEqual([friend]);
    expect(toast.error).toHaveBeenCalledWith("Something went wrong. Try again.");
  });
});
