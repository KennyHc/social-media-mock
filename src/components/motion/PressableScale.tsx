"use client";

import {
  animate,
  motion,
  useMotionValue,
  type useAnimationControls,
  type TargetAndTransition,
} from "motion/react";
import {
  useEffect,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ElementType,
  type KeyboardEvent,
  type Ref,
} from "react";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import { pressScale, spring } from "@/motion/tokens";

const cache = new Map<ElementType, ComponentType<Record<string, unknown>>>();

function motionFor(as: ElementType): ComponentType<Record<string, unknown>> {
  let c = cache.get(as);
  if (!c) {
    c = motion.create(as as "div") as unknown as ComponentType<Record<string, unknown>>;
    cache.set(as, c);
  }
  return c;
}

type OwnProps = {
  /** Visual-only disable: no press feedback. For `button`, also sets `disabled`. */
  disabled?: boolean;
  /** Pass animation controls (for example from useShake) to drive extra motion. */
  animate?: ReturnType<typeof useAnimationControls> | TargetAndTransition;
  ref?: Ref<Element>;
};

export type PressableScaleProps<T extends ElementType = "button"> = {
  /** Element or component to render: "button", "a", "div" or next/link's Link. */
  as?: T;
} & OwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof OwnProps | "as">;

/**
 * Polymorphic press feedback: scales to `pressScale` on tap or Enter/Space
 * (spring.snappy) and springs back on release. Reduced motion dims instead.
 */
export function PressableScale<T extends ElementType = "button">({
  as,
  disabled,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...rest
}: PressableScaleProps<T>) {
  const reduced = usePrefersReducedMotion();
  // Cached per element type at module level, so the component identity is stable across renders.
  const Comp = motionFor((as ?? "button") as ElementType);
  const scaleValue = useMotionValue(1);
  const isButton = (as ?? "button") === "button";

  useEffect(() => () => scaleValue.stop(), [scaleValue]);

  const press = () => {
    if (!reduced && !disabled) animate(scaleValue, pressScale, spring.snappy);
  };
  const release = () => {
    if (!reduced) animate(scaleValue, 1, spring.snappy);
  };
  const isActivationKey = (e: KeyboardEvent) => e.key === "Enter" || e.key === " ";

  return (
    // eslint-disable-next-line react-hooks/static-components
    <Comp
      {...rest}
      style={{ ...(rest.style as object | undefined), scale: scaleValue }}
      whileTap={disabled ? undefined : reduced ? { opacity: 0.75 } : { scale: pressScale }}
      transition={spring.snappy}
      {...(isButton ? { disabled } : { "aria-disabled": disabled || undefined })}
      onKeyDown={(e: KeyboardEvent) => {
        if (isActivationKey(e) && !e.repeat) press();
        (onKeyDown as ((e: KeyboardEvent) => void) | undefined)?.(e);
      }}
      onKeyUp={(e: KeyboardEvent) => {
        if (isActivationKey(e)) release();
        (onKeyUp as ((e: KeyboardEvent) => void) | undefined)?.(e);
      }}
      onBlur={(e: unknown) => {
        release();
        (onBlur as ((e: unknown) => void) | undefined)?.(e);
      }}
    />
  );
}
