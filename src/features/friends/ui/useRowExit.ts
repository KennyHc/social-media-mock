"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

export type ExitMode = "collapse" | "dismiss";

type Pending = { index: number; ids: string[] };

/**
 * Tracks each row's exit style plus focus hand-off after removal.
 * `setExit` commits synchronously so the row is rendered with its exit
 * style before the optimistic cache update unmounts it. After a row leaves
 * `ids`, focus goes to the next row's `[data-focus-id]` element, else `fallback`.
 */
export function useRowExit(ids: string[], fallback: RefObject<HTMLElement | null>) {
  const [modes, setModes] = useState<Record<string, ExitMode>>({});
  const pending = useRef(new Map<string, Pending>());
  const idsKey = ids.join("|");

  const setExit = useCallback(
    (id: string, mode: ExitMode | undefined) => {
      if (mode) pending.current.set(id, { index: ids.indexOf(id), ids });
      else pending.current.delete(id);
      flushSync(() =>
        setModes((m) => {
          const next = { ...m };
          if (mode) next[id] = mode;
          else delete next[id];
          return next;
        }),
      );
    },
    [ids],
  );

  useEffect(() => {
    let last: Pending | null = null;
    for (const [id, p] of pending.current) {
      if (ids.includes(id)) continue;
      pending.current.delete(id);
      last = p;
    }
    if (!last) return;
    const next = last.ids.slice(last.index + 1).find((id) => ids.includes(id));
    const target = next
      ? document.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(next)}"]`)
      : fallback.current;
    target?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id list
  }, [idsKey]);

  return { modes, setExit };
}
