import type { Metadata } from "next";
import { FriendsScreen } from "@/features/friends/ui/FriendsScreen";

export const metadata: Metadata = { title: "Friends" };

export default function FriendsPage() {
  return <FriendsScreen />;
}
