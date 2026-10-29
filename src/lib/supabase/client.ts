import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser Supabase client (singleton). All reads go through RLS as the signed-in user. */
export function supabaseBrowser() {
  client ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
