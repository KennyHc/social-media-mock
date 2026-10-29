import { QueryClient } from "@tanstack/react-query";

/**
 * Only transport failures are worth retrying. A response from Supabase (an RLS
 * denial, a stable RPC error code like `not_allowed`) is a final answer, and
 * retrying it would hide the error and skip the optimistic rollback.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // fetch() rejects with TypeError on network failure
  const message = (error as { message?: string } | null)?.message ?? "";
  return /failed to fetch|network|load failed|timeout/i.test(message);
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cached data instantly, refresh in the background.
        staleTime: 30_000,
        gcTime: 24 * 60 * 60_000,
        refetchOnWindowFocus: true,
        retry: (count, error) => count < 2 && isNetworkError(error),
      },
      mutations: { retry: (count, error) => count < 1 && isNetworkError(error) },
    },
  });
}
