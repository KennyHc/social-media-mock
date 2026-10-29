"use client";

import { motion } from "motion/react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { PressableScale } from "@/components/motion/PressableScale";
import { prefersReducedMotion } from "@/motion/reduced-motion";
import { enter, spring } from "@/motion/tokens";

type Theme = "light" | "dark";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
const getTheme = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const getServerTheme = (): Theme => "light";

/**
 * Light/dark toggle. The attribute swap runs inside document.startViewTransition
 * (crossfade) when supported and motion is allowed, otherwise switches instantly.
 * Persists to localStorage.theme. Sun and moon crossfade with a rotation (spring.snappy).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const dark = theme === "dark";

  const toggle = () => {
    const next: Theme = dark ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {
        // Private mode: the theme still applies for this session.
      }
    };
    if (typeof document.startViewTransition === "function" && !prefersReducedMotion()) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  };

  const icon = "absolute inset-0 m-auto";
  return (
    <PressableScale
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "relative grid size-10 place-items-center rounded-full border border-border bg-surface text-fg",
        className,
      )}
    >
      <motion.svg
        className={icon}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        initial={false}
        animate={{ opacity: dark ? 0 : 1, rotate: dark ? 90 : 0 }}
        transition={{ opacity: enter, rotate: spring.snappy }}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </motion.svg>
      <motion.svg
        className={icon}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        initial={false}
        animate={{ opacity: dark ? 1 : 0, rotate: dark ? 0 : -90 }}
        transition={{ opacity: enter, rotate: spring.snappy }}
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </motion.svg>
    </PressableScale>
  );
}
