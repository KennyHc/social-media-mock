"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/cn";
import { CheckmarkDraw } from "@/components/motion/CheckmarkDraw";
import { PressableScale } from "@/components/motion/PressableScale";
import { Spinner } from "@/components/motion/Spinner";
import { useShake } from "@/components/motion/Shake";
import { haptic } from "@/motion/haptics";
import { enter, exitT, timing } from "@/motion/tokens";

export type ButtonState = "idle" | "loading" | "success" | "error";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Controlled state. Omit to let `onClickAsync` drive it. */
  state?: ButtonState;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /**
   * Async click handler. The button shows loading while it runs, then success
   * (about 1.2 s) or error (shake) and returns to idle.
   */
  onClickAsync?: () => Promise<unknown>;
  /** Screen reader text per state. */
  announce?: Partial<Record<Exclude<ButtonState, "idle">, string>>;
};

const variants = {
  primary: "bg-accent text-accent-fg hover:brightness-105",
  secondary: "border border-border bg-surface-2 text-fg hover:brightness-95",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  danger: "bg-danger text-danger-fg hover:brightness-105",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
} as const;

const defaultAnnounce = { loading: "Loading", success: "Done", error: "Something went wrong" };

/**
 * Button with built-in async feedback. The label always stays in layout (hidden
 * while busy) and the state icon is overlaid, so width never jumps. Loading
 * crossfades to a spinner, success draws a checkmark, error shakes.
 */
export function Button({
  variant = "primary",
  size = "md",
  state: stateProp,
  onClick,
  onClickAsync,
  announce,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const [internal, setInternal] = useState<ButtonState>("idle");
  const state = stateProp ?? internal;
  const { controls, shake } = useShake();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (state === "error") {
      haptic("error");
      void shake();
    } else if (state === "success") {
      haptic("success");
    }
  }, [state, shake]);

  const settle = useCallback((next: ButtonState) => {
    if (!alive.current) return;
    setInternal(next);
    timer.current = setTimeout(() => {
      if (alive.current) setInternal("idle");
    }, timing.successHoldMs);
  }, []);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (state === "loading") return;
    onClick?.(e);
    if (!onClickAsync) return;
    if (timer.current) clearTimeout(timer.current);
    setInternal("loading");
    onClickAsync().then(
      () => settle("success"),
      () => settle("error"),
    );
  };

  const busy = state === "loading";
  const labels = { ...defaultAnnounce, ...announce };
  return (
    <>
    <PressableScale
      type={type}
      animate={controls}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={handleClick}
      className={cn(
        "relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition-[background-color,border-color,color,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      <motion.span
        className="inline-flex items-center gap-2"
        animate={{ opacity: state === "idle" ? 1 : 0 }}
        transition={state === "idle" ? enter : exitT}
      >
        {children}
      </motion.span>
      <span className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          {state === "loading" && (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: enter }}
              exit={{ opacity: 0, transition: exitT }}
            >
              <Spinner />
            </motion.span>
          )}
          {state === "success" && (
            <motion.span key="success" exit={{ opacity: 0, transition: exitT }}>
              <CheckmarkDraw bare size={20} />
            </motion.span>
          )}
          {state === "error" && (
            <motion.span
              key="error"
              className="text-lg font-bold leading-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: enter }}
              exit={{ opacity: 0, transition: exitT }}
            >
              !
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </PressableScale>
    <span className="sr-only" role="status" aria-live="polite">
      {state === "idle" ? "" : labels[state]}
    </span>
    </>
  );
}
