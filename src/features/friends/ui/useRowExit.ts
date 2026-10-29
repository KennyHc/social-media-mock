"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export type ExitMode = "collapse" | "dismiss";

/**
 * Tracks each row's exit style plus focus hand-off after removal.
 * `setExit` commits synchronously so the row is rendered with its exit
 * style before the optimistic cache update unmounts it.
 */
export function useRowExit(ids: string[]) {
  const [modes, setModes] = useState<Record<string, ExitMode>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<{ id: string; index: number; ids: string[] } | null>(null);
  const idsKey = ids.join("|");

  const setExit = useCallback(
    (id: string, mode: ExitMode | undefined) => {
      const index = ids.indexOf(id);
      if (mode) pending.current = { id, index, ids };
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
    const p = pending.current;
    if (!p || ids.includes(p.id)) return;
    pending.current = null;
    const next = p.ids.slice(p.index + 1).find((id) => ids.includes(id));
    const target = next
      ? document.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(next)}"]`)
      : heading.current;
    target?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id list
  }, [idsKey]);

  return { modes, setExit, heading };
}
