"use client";

import { useIsPresent } from "motion/react";
import { useCallback, useEffect, useId, useSyncExternalStore, type RefObject } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab focus inside `ref` while `active`, moves focus in on activation and
 * restores it to the previously focused element (the opener) on deactivation.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  isTop: () => boolean = () => true,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const opener = document.activeElement as HTMLElement | null;
    (el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !isTop()) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      } else if (!el.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [ref, active, isTop]);
}

let lockCount = 0;
let previous = { overflow: "", paddingRight: "" };

/** Locks body scroll while `active` (ref-counted so stacked overlays are safe). */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    if (lockCount === 0) {
      previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        body.style.overflow = previous.overflow;
        body.style.paddingRight = previous.paddingRight;
      }
    };
  }, [active]);
}

// Module-level stack of open dialogs: only the topmost reacts to Escape and Tab.
const dialogStack: string[] = [];

/**
 * Shared dialog behavior for Sheet and Modal layers: focus trap + restore,
 * scroll lock and Escape to close. Active only while the layer is present
 * (not while it plays its exit animation) and only the topmost dialog handles
 * Escape and Tab. Returns whether the layer is present.
 */
export function useDialogBehavior(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
): boolean {
  const present = useIsPresent();
  const id = useId();
  const isTop = useCallback(() => dialogStack[dialogStack.length - 1] === id, [id]);

  useEffect(() => {
    if (!present) return;
    dialogStack.push(id);
    return () => {
      const i = dialogStack.indexOf(id);
      if (i >= 0) dialogStack.splice(i, 1);
      };
  }, [present, id]);

  useFocusTrap(ref, present, isTop);
  useScrollLock(present);
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isTop()) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [present, onClose, isTop]);
  return present;
}

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards. Gate portals with it. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Subscribes to a CSS media query. False on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
