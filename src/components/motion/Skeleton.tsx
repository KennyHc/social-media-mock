import { cn } from "@/lib/cn";

export type SkeletonProps = {
  /** Size and shape it with utilities, e.g. "h-4 w-32 rounded-md". */
  className?: string;
};

/**
 * Loading placeholder. A gradient strip translates across (CSS keyframe in
 * globals.css, transform only, 1.4 s linear loop). Under reduced motion it
 * becomes a slow opacity pulse. Decorative: aria-hidden.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton relative overflow-hidden rounded-lg bg-surface-2", className)}
    >
      <div className="skeleton-shimmer pointer-events-none absolute inset-0" />
    </div>
  );
}
