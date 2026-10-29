import type { CreateTypes } from "canvas-confetti";
import { prefersReducedMotion } from "@/motion/reduced-motion";
import { palette, particles } from "@/motion/tokens";

export type CelebrateOrigin = { x: number; y: number } | HTMLElement;

export type CelebrateOptions = {
  tier: "small" | "large";
  /** Viewport px point or an element (its center is used). Defaults to the screen center. */
  origin?: CelebrateOrigin;
};

const importConfetti = () => import("canvas-confetti");

let modulePromise: ReturnType<typeof importConfetti> | null = null;
let canvas: HTMLCanvasElement | null = null;
let fire: CreateTypes | null = null;
let active = 0;

const loadModule = () => (modulePromise ??= importConfetti());

/** Warms the canvas-confetti chunk. Call on hover or press-start of a trigger. */
export function preloadCelebrate(): void {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  loadModule().catch(() => {
    modulePromise = null;
  });
}

async function ensureFire(): Promise<CreateTypes> {
  const mod = await loadModule();
  if (fire && canvas?.isConnected) return fire;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "90",
  });
  document.body.appendChild(canvas);
  const instance = mod.default.create(canvas, { resize: true, useWorker: true });
  fire = instance;
  return instance;
}

function release() {
  active -= 1;
  if (active > 0) return;
  fire?.reset();
  canvas?.remove();
  canvas = null;
  fire = null;
}

function normalize(origin?: CelebrateOrigin): { x: number; y: number } {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!origin) return { x: 0.5, y: 0.5 };
  if (origin instanceof HTMLElement) {
    const r = origin.getBoundingClientRect();
    return { x: (r.left + r.width / 2) / w, y: (r.top + r.height / 2) / h };
  }
  return { x: origin.x / w, y: origin.y / h };
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/**
 * Fires confetti. `small`: a confetti pop plus a ring of round particles.
 * `large`: a multi-burst shower over about 1.2 s. canvas-confetti is loaded on
 * first call and one shared full-viewport canvas is removed when bursts end.
 * Under reduced motion nothing happens and `{ reduced: true }` is returned so
 * the caller can show a checkmark or toast instead.
 */
export async function celebrate({
  tier,
  origin,
}: CelebrateOptions): Promise<{ reduced: boolean }> {
  if (typeof window === "undefined" || prefersReducedMotion()) return { reduced: true };
  active += 1;
  try {
    const shoot = await ensureFire();
    const colors = palette();
    const o = normalize(origin);
    const { gravity, decay, startVelocity, ticks, spread } = particles.physics;
    const base = { colors, gravity, decay, ticks, disableForReducedMotion: true };
    const runs: Array<Promise<unknown> | null> = [];

    if (tier === "small") {
      runs.push(
        shoot({
          ...base,
          particleCount: particles.small.count,
          spread: particles.small.spread,
          startVelocity,
          origin: o,
          angle: 90,
        }),
        shoot({
          ...base,
          particleCount: particles.burst.count + 4,
          spread: 360,
          startVelocity: startVelocity * 0.5,
          shapes: ["circle"],
          scalar: 0.8,
          origin: o,
        }),
      );
    } else {
      const { count, bursts, durationMs } = particles.large;
      const per = Math.round(count / bursts);
      for (let i = 0; i < bursts; i++) {
        runs.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              const side = i % 2 === 0 ? -1 : 1;
              const done = shoot({
                ...base,
                particleCount: per,
                spread,
                startVelocity,
                angle: i === 2 ? 90 : 90 - side * 25,
                origin: { x: clamp01(o.x + (i === 2 ? 0 : side * 0.2)), y: o.y },
              });
              (done ?? Promise.resolve()).then(() => resolve(), () => resolve());
            }, (i * durationMs) / bursts);
          }),
        );
      }
    }
    await Promise.all(runs.map((r) => r ?? Promise.resolve()));
    return { reduced: false };
  } catch {
    // Confetti is decorative; a failed chunk load must never break the caller.
    return { reduced: false };
  } finally {
    release();
  }
}
