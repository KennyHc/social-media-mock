"use client";

import { createContext, createElement, useContext, useState, type ReactNode } from "react";
import { timing } from "@/motion/tokens";

/** Tiny store of "row ids that should shake once they have (re-)entered". */
export type RollbackShakeStore = {
  flag: (id: string) => void;
  /** Returns true (and clears the flag) if `id` was flagged. */
  consume: (id: string) => boolean;
  subscribe: (fn: () => void) => () => void;
  dispose: () => void;
};

function createStore(): RollbackShakeStore {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();
  const clear = (id: string) => {
    const t = pending.get(id);
    if (t !== undefined) clearTimeout(t);
    return pending.delete(id);
  };
  return {
    flag(id) {
      clear(id);
      // Flags expire so a row that never returns cannot shake later by surprise.
      pending.set(id, setTimeout(() => pending.delete(id), timing.shakeFlagMs));
      listeners.forEach((fn) => fn());
    },
    consume: clear,
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    dispose() {
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
    },
  };
}

const Ctx = createContext<RollbackShakeStore | null>(null);

/** Row-side access (used by AnimatedRow). Null when no provider is mounted. */
export function useRollbackShakeStore(): RollbackShakeStore | null {
  return useContext(Ctx);
}

export type RollbackShakeProviderProps = {
  children?: ReactNode;
  /** Store from `useRollbackShake().shakeProps`; omit to create a private one. */
  store?: RollbackShakeStore;
};

/** Provides the shake store to descendant AnimatedRows. */
export function RollbackShakeProvider({ children, store }: RollbackShakeProviderProps) {
  const [own] = useState(createStore);
  return createElement(Ctx.Provider, { value: store ?? own }, children);
}

/**
 * `shake(id)` flags a row; the AnimatedRow with that id plays the Shake once it
 * has entered (immediately if it is already on screen), then clears the flag.
 *
 * Works two ways:
 * - inside a `<RollbackShakeProvider>` it uses that provider's store;
 * - in the component that renders the list (above any provider) spread
 *   `shakeProps` on the provider: `<RollbackShakeProvider {...shakeProps}>`.
 */
export function useRollbackShake(): {
  shake: (id: string) => void;
  shakeProps: { store: RollbackShakeStore };
} {
  const ctx = useContext(Ctx);
  const [own] = useState(createStore);
  const store = ctx ?? own;
  // shake is stable per store; no effect cleanup needed beyond timers expiring.
  return { shake: store.flag, shakeProps: { store } };
}
