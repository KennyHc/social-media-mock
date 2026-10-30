"use client";

import { timing } from "@/motion/tokens";

export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss time in ms; 0 keeps it until dismissed. */
  duration: number;
};

export type ToastOptions = {
  id?: string;
  /** Auto-dismiss time in ms. Defaults to 4000. */
  duration?: number;
};

/** Newest toast is first. At most MAX_VISIBLE are kept. */
export const MAX_VISIBLE = 3;

const EMPTY: ToastItem[] = [];
let items: ToastItem[] = EMPTY;
let counter = 0;
const listeners = new Set<() => void>();

function emit(next: ToastItem[]) {
  items = next;
  listeners.forEach((l) => l());
}

/** useSyncExternalStore subscribe function for the toast store. */
export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Snapshot of the current toasts (stable between changes). */
export const getToasts = (): ToastItem[] => items;
/** Server snapshot: always empty. */
export const getServerToasts = (): ToastItem[] => EMPTY;

function push(kind: ToastKind, message: string, opts: ToastOptions = {}): string {
  const id = opts.id ?? `toast-${++counter}`;
  const item: ToastItem = { id, kind, message, duration: opts.duration ?? timing.toastMs };
  emit([item, ...items.filter((t) => t.id !== id)].slice(0, MAX_VISIBLE));
  return id;
}

/** Removes a toast (it plays its exit animation). */
function dismiss(id?: string): void {
  emit(id ? items.filter((t) => t.id !== id) : EMPTY);
}

/** Imperative toast API. Render `<Toaster />` once near the app root. */
export const toast = {
  success: (message: string, opts?: ToastOptions) => push("success", message, opts),
  error: (message: string, opts?: ToastOptions) => push("error", message, opts),
  info: (message: string, opts?: ToastOptions) => push("info", message, opts),
  dismiss,
};
