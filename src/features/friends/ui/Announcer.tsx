"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Announce = (message: string) => void;
const Ctx = createContext<Announce>(() => {});

/** Polite live region for friend events; `useAnnounce()` writes into it. */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const announce = useCallback((m: string) => {
    // Toggle a trailing space so repeated messages are re-announced.
    setMessage((prev) => (prev === m ? `${m} ` : m));
  }, []);
  const value = useMemo(() => announce, [announce]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </Ctx.Provider>
  );
}

export const useAnnounce = () => useContext(Ctx);
