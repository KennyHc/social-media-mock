"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/client";
import { qk } from "@/lib/query/keys";
import { usernameSchema } from "@/lib/validation";

export type Availability =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "checking" }
  | { status: "available" }
  | { status: "taken" }
  | { status: "error" };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Validates locally, then checks availability with a debounced RPC call. */
export function useUsernameAvailability(raw: string): Availability {
  const parsed = usernameSchema.safeParse(raw);
  const name = parsed.success ? parsed.data : "";
  const debounced = useDebounced(name, 350);

  const query = useQuery({
    queryKey: qk.usernameAvailable(debounced),
    enabled: debounced.length > 0,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabaseBrowser().rpc("username_available", { name: debounced });
      if (error) throw error;
      return Boolean(data);
    },
  });

  if (!raw.trim()) return { status: "idle" };
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid" };
  if (debounced !== name || query.isFetching || query.isPending) return { status: "checking" };
  if (query.isError) return { status: "error" };
  return query.data ? { status: "available" } : { status: "taken" };
}

/**
 * Saves username + display name, then refreshes the session so the JWT carries
 * app_metadata.onboarded (which the proxy uses to stop redirecting to /onboarding).
 */
export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (input: { username: string; displayName: string }) => {
      const supabase = supabaseBrowser();
      const { error } = await supabase.rpc("complete_onboarding", {
        username: input.username,
        display_name: input.displayName,
      });
      if (error) throw error;
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
    },
  });
}
