"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type AvatarProps = {
  src?: string | null;
  /** Used for the initials fallback and the alt text. */
  name?: string | null;
  /** Pixel size (width and height). */
  size?: number;
  /** Load eagerly (above the fold). Lazy otherwise. */
  priority?: boolean;
  className?: string;
};

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Round avatar with a fixed size and an initials fallback. */
export function Avatar({ src, name, size = 40, priority = false, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full bg-surface-2 font-medium text-fg-muted",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- fixed-size remote avatar, no optimizer needed
        <img
          src={src as string}
          alt={name ? `${name}'s avatar` : ""}
          width={size}
          height={size}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src ?? null)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden={name ? undefined : true} aria-label={name ?? undefined}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
