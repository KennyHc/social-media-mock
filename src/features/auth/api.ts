import { supabaseBrowser } from "@/lib/supabase/client";
import { env } from "@/lib/env";

export async function signInWithGoogle(next = "/feed") {
  const redirectTo = `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabaseBrowser().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabaseBrowser().auth.signOut();
  window.location.assign("/login");
}

/** Maps stable RPC error codes (raised by the database) to user-facing messages. */
export const rpcErrorMessage: Record<string, string> = {
  username_taken: "That username is taken.",
  username_reserved: "That username is reserved.",
  invalid_username: "Use 3–20 lowercase letters, numbers or underscores.",
  already_onboarded: "Your profile is already set up.",
  not_found: "We couldn't find that user.",
  self: "That's you!",
  already_friends: "You're already friends.",
  already_requested: "Request already sent.",
  not_allowed: "You can't do that.",
  empty_post: "Add some text or a photo.",
};

export function messageFor(error: { message?: string } | null | undefined, fallback = "Something went wrong. Try again.") {
  const code = error?.message?.trim();
  return (code && rpcErrorMessage[code]) || fallback;
}
