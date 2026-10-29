"use client";

import { animate } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import { ease, palette, particles, simulateParticle } from "@/motion/tokens";

export type ParticleBurstProps = {
  /** Fires a burst each time this value changes (not on mount). */
  trigger: unknown;
  className?: string;
};

/**
 * Small local effect (like button, reactions): about 10 circles and hearts
 * radiate from the center using the same palette and physics as the confetti
 * (outward velocity with gentle gravity), then fade and shrink in about 520 ms.
 * Place inside a `relative` parent. Pointer-transparent; nothing under reduced motion.
 */
export function ParticleBurst({ trigger, className }: ParticleBurstProps) {
  const reduced = usePrefersReducedMotion();
  const host = useRef<HTMLSpanElement>(null);
  const last = useRef(trigger);

  useEffect(() => {
    if (last.current === trigger) return;
    last.current = trigger;
    const el = host.current;
    if (!el || reduced) return;

    const colors = palette();
    const { count, frames, velocityScale, size } = particles.burst;
    const seconds = frames / 60;
    const nodes: HTMLSpanElement[] = [];
    const runs: Array<{ stop: () => void }> = [];

    for (let i = 0; i < count; i++) {
      const heart = i % 3 === 0;
      const node = document.createElement("span");
      node.style.cssText = `position:absolute;left:${-size / 2}px;top:${-size / 2}px;width:${size}px;height:${size}px;line-height:${size}px;font-size:${size + 3}px;text-align:center;`;
      const color = colors[i % Math.max(colors.length, 1)] ?? "currentColor";
      if (heart) {
        node.textContent = "♥";
        node.style.color = color;
      } else {
        node.style.borderRadius = "9999px";
        node.style.background = color;
      }
      el.appendChild(node);
      nodes.push(node);

      const angle = ((i + Math.random() * 0.6) / count) * Math.PI * 2;
      const v = particles.physics.startVelocity * velocityScale * (0.7 + Math.random() * 0.6);
      const path = simulateParticle(angle, v);
      runs.push(
        animate(
          node,
          {
            x: path.x,
            y: path.y,
            opacity: [1, 1, 0],
            scale: [0.6, 1, 0.3],
          },
          { duration: seconds, ease: ease.linear },
        ),
      );
    }

    const done = Promise.all(runs.map((r) => (r as unknown as Promise<unknown>).catch(() => {})));
    let cancelled = false;
    done.then(() => {
      if (!cancelled) nodes.forEach((n) => n.remove());
    });
    return () => {
      cancelled = true;
      runs.forEach((r) => r.stop());
      nodes.forEach((n) => n.remove());
    };
  }, [trigger, reduced]);

  return (
    <span
      ref={host}
      aria-hidden="true"
      className={cn("pointer-events-none absolute left-1/2 top-1/2 h-0 w-0", className)}
    />
  );
}
