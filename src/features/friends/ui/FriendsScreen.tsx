"use client";

import { useRef } from "react";
import { RollbackShakeProvider } from "@/components/motion";
import { TopNav } from "@/components/ui/TopNav";
import { AnnouncerProvider } from "./Announcer";
import { FriendsSection } from "./FriendsSection";
import { RequestsSection } from "./RequestsSection";
import { SearchCard } from "./SearchCard";

export function FriendsScreen() {
  const input = useRef<HTMLInputElement>(null);
  return (
    <AnnouncerProvider>
      <RollbackShakeProvider>
        <TopNav />
        <main className="mx-auto w-full max-w-md px-4 pb-16 pt-4">
          <h1 className="sr-only">Friends</h1>
          <SearchCard inputRef={input} />
          <RequestsSection />
          <FriendsSection onFindFriend={() => input.current?.focus()} />
        </main>
      </RollbackShakeProvider>
    </AnnouncerProvider>
  );
}
