import { notFound } from "next/navigation";
import { FriendsScreen } from "@/features/friends/ui/FriendsScreen";

// Dev-only harness: renders the real friends screen so Playwright can drive it
// against intercepted Supabase RPC responses (the proxy lets /dev through outside production).
export default function DevFriendsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FriendsScreen />;
}
