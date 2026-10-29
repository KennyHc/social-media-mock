"use client";

import { useQuery } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/client";
import { qk } from "@/lib/query/keys";

export type Me = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/** Current user's profile (null when signed out). */
export function useMe() {
  return useQuery({
    queryKey: qk.me(),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Me | null> => {
      const supabase = supabaseBrowser();
      const { data: claims } = await supabase.auth.getClaims();
      const id = claims?.claims.sub;
      if (!id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Me;
    },
  });
}
