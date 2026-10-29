import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cached data instantly, refresh in the background.
        staleTime: 30_000,
        gcTime: 24 * 60 * 60_000,
        refetchOnWindowFocus: true,
        retry: 2,
      },
      mutations: { retry: 1 },
    },
  });
}
