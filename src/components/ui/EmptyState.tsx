import type { ReactNode } from "react";
import { BreathingCircles } from "@/components/motion";
import { cn } from "@/lib/cn";

export type EmptyStateProps = {
  title: string;
  body: string;
  /** Optional call to action (a Button). */
  action?: ReactNode;
  className?: string;
};

/** Illustrated empty state: breathing circles, a title, a body and an optional action. */
export function EmptyState({ title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-8 text-center", className)}>
      <BreathingCircles />
      <h3 className="mt-4 text-lg font-semibold text-fg">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-fg-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
