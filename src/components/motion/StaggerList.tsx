"use client";

import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { distance, enter, exitT, layout, scale, staggerDelay } from "@/motion/tokens";
import { usePrefersReducedMotion } from "@/motion/reduced-motion";
import { useIsClient } from "./a11y";

export type StaggerListProps = {
  children: ReactNode;
  className?: string;
  /** Element to render. Defaults to div; use "ul" with `StaggerItem as="li"`. */
  as?: "div" | "ul" | "ol";
};

/**
 * Container for keyed, dynamic lists. Initial items enter staggered
 * (`staggerDelay`, capped); items added later enter immediately. Removed items
 * collapse (fade + scale) while siblings slide via layout on spring.gentle.
 * Children must have stable `key`s and should be `StaggerItem`s.
 */
export function StaggerList({ children, className, as = "div" }: StaggerListProps) {
  const keyed = Children.toArray(children);
  // Keys present on first render stagger; anything added later enters immediately.
  const [initialKeys] = useState(() => new Set(keyed.map((c) => (isValidElement(c) ? c.key : null))));
  const Comp = motion[as] as typeof motion.div;
  let i = 0;
  const indexed = keyed.map((child) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ index?: number }>;
    const index = initialKeys.has(el.key) ? i++ : 0;
    return el.props.index === undefined ? cloneElement(el, { index }) : el;
  });
  return (
    <Comp className={cn("relative", className)}>
      <AnimatePresence mode="popLayout">{indexed}</AnimatePresence>
    </Comp>
  );
}

export type StaggerItemProps = Omit<
  HTMLMotionProps<"div">,
  "initial" | "animate" | "exit" | "transition" | "layout"
> & {
  /** Position in the list; injected by StaggerList. */
  index?: number;
  as?: "div" | "li";
};

/** A StaggerList child: fades up on enter, collapses on exit, slides on sibling changes. */
export function StaggerItem({ index = 0, as = "div", ...props }: StaggerItemProps) {
  const reduced = usePrefersReducedMotion();
  const delay = staggerDelay(index);
  const hydrated = useIsClient();
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      // "ssr" arms a CSS safety net in globals.css that reveals the item if JS never hydrates.
      data-stagger={hydrated ? "ready" : "ssr"}
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: distance.enterY }}
      animate={{ opacity: 1, y: 0, transition: { ...enter, delay } }}
      exit={
        reduced
          ? { opacity: 0, transition: exitT }
          : { opacity: 0, scale: scale.itemExit, transition: exitT }
      }
      transition={{ layout }}
      {...props}
    />
  );
}
