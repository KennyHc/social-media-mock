import { cn } from "@/lib/cn";

/** The Circle mark: two overlapping circles (same shapes as the splash). */
export function Logo({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <circle cx="38" cy="48" r="20" fill="var(--accent)" fillOpacity="0.9" />
      <circle cx="58" cy="48" r="20" fill="var(--accent-3)" fillOpacity="0.8" />
    </svg>
  );
}
