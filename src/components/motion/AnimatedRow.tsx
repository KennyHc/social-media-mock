"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  type HTMLMotionProps,
  type Variants,
} from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { reduceVariants, usePrefersReducedMotion } from "@/motion/reduced-motion";
import {
  distance,
  duration,
  ease,
  enter,
  exitT,
  layout,
  opacity as opacityTokens,
  scale,
  staggerDelay,
  timing,
} from "@/motion/tokens";
import { useRollbackShakeStore } from "./useRollbackShake";

export type RowExit = "collapse" | "dismiss";

class ListCtx {
  private exitFor: ((id: string) => RowExit) | undefined;
  private settledFlag = false;
  constructor(readonly skipInitial: boolean) {}
  /** Latest `exitFor` from the list, read at exit time. */
  setExitFor(fn: ((id: string) => RowExit) | undefined) {
    this.exitFor = fn;
  }
  resolveExit(id: string): RowExit | undefined {
    return this.exitFor?.(id);
  }
  /** False until the list's first commit finished; rows mounted before that stagger in. */
  settle() {
    this.settledFlag = true;
  }
  isSettled() {
    return this.settledFlag;
  }
}
const ListContext = createContext<ListCtx | null>(null);

export type AnimatedListProps = Omit<HTMLMotionProps<"ul">, "ref" | "layout" | "children"> & {
  children?: ReactNode;
  /** Render a `ul` (default, rows are `li`) or a `div` (rows use `as="div"`). */
  as?: "ul" | "div";
  /**
   * Chooses the exit of a row by id at the moment it exits. Wins over the row's own `exit`
   * prop. Use it when the row is deleted from data before you know why (e.g. mutation
   * onSuccess sets the reason in a ref). Rows otherwise use their last-rendered `exit`.
   */
  exitFor?: (id: string) => RowExit;
  /**
   * Whether rows present on first render animate in (staggered). Defaults to true; pass
   * false to render them settled (AnimatePresence `initial={false}`).
   */
  initialAnimation?: boolean;
};

/**
 * AnimatePresence (mode="popLayout", so exiting rows leave the flow immediately and
 * siblings glide up) around a `motion.ul`/`div` with `layout`.
 * Children must be keyed `AnimatedRow`s.
 */
export function AnimatedList({
  children,
  as = "ul",
  exitFor,
  initialAnimation = true,
  className,
  ...rest
}: AnimatedListProps) {
  const [ctx] = useState(() => new ListCtx(!initialAnimation));
  useLayoutEffect(() => ctx.setExitFor(exitFor));
  useEffect(() => ctx.settle(), [ctx]);
  const Comp = (as === "div" ? motion.div : motion.ul) as typeof motion.ul;
  return (
    <ListContext.Provider value={ctx}>
      <Comp layout transition={layout} className={`relative ${className ?? ""}`.trim()} {...rest}>
        <AnimatePresence mode="popLayout" initial={initialAnimation}>
          {children}
        </AnimatePresence>
      </Comp>
    </ListContext.Provider>
  );
}

/** Mutable per-row state read from animation callbacks (kept out of refs for the React compiler lint). */
class RowState {
  entered: boolean;
  delay: number;
  id = "";
  exit: RowExit = "collapse";
  constructor(entered: boolean, delay: number) {
    this.entered = entered;
    this.delay = delay;
  }
  sync(id: string, exit: RowExit) {
    this.id = id;
    this.exit = exit;
  }
  setEntered(v: boolean) {
    this.entered = v;
  }
  clearDelay() {
    this.delay = 0;
  }
}

export type AnimatedRowProps = Omit<
  HTMLMotionProps<"li">,
  "id" | "exit" | "layout" | "variants" | "initial" | "animate" | "custom" | "style"
> & {
  /** Stable row id (also used by `useRollbackShake().shake(id)`). Not forwarded to the DOM. */
  id: string;
  /** "collapse" (accepted) fades and shrinks to .98; "dismiss" (declined, cancelled, removed) fades and slides left 16px. */
  exit?: RowExit;
  /** Position in the initial list, for the first-render stagger (capped). */
  index?: number;
  as?: "li" | "div";
  style?: HTMLMotionProps<"li">["style"];
};

const exitTarget = (kind: RowExit) =>
  kind === "dismiss"
    ? { opacity: 0, x: -distance.dismissX, transition: exitT }
    : { opacity: 0, scale: scale.itemExit, transition: exitT };

/**
 * List row. Enter: opacity 0 to 1 and y 12 to 0 (duration.short, ease.out); rows from the
 * first render stagger by `staggerDelay(index)`, later rows enter immediately.
 * Exit (exit(duration.short), ease.in): see `RowExit`. The exit is resolved when the exit
 * starts, from `AnimatedList.exitFor(id)` or else the row's last-rendered `exit` prop, so
 * it still works after the row was deleted from the data. Siblings move via layout on
 * spring.gentle. The enter target resets x/scale, so re-inserting a row mid-exit or after a
 * rollback animates back smoothly. Plays a Shake when flagged through `useRollbackShake`.
 * Reduced motion: opacity only.
 */
export function AnimatedRow({
  id,
  exit = "collapse",
  index = 0,
  as = "li",
  style,
  children,
  onAnimationComplete,
  ...rest
}: AnimatedRowProps) {
  const list = useContext(ListContext);
  const store = useRollbackShakeStore();
  const reduced = usePrefersReducedMotion();
  const present = useIsPresent();

  const [rs] = useState(
    () =>
      new RowState(
        !!list && list.skipInitial && !list.isSettled(),
        list && !list.isSettled() && !list.skipInitial ? staggerDelay(index) : 0,
      ),
  );

  const x = useMotionValue(0);
  const dip = useMotionValue(1);
  const playing = useRef<{ stop: () => void } | null>(null);

  const variants = (() => {
    const v: Variants = {
      hidden: { opacity: 0, y: distance.enterY },
      show: () => ({
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        transition: { ...enter, delay: rs.delay },
      }),
      gone: () => exitTarget(list?.resolveExit(rs.id) ?? rs.exit),
    };
    return reduced ? reduceVariants(v) : v;
  })();

  useEffect(() => {
    if (!present) rs.setEntered(false);
  }, [present, rs]);

  const tryShake = useRef(() => {});
  useLayoutEffect(() => {
    rs.sync(id, exit);
    tryShake.current = () => {
      if (!store || !rs.entered || !present || !store.consume(id)) return;
      playing.current?.stop();
      playing.current = reduced
        ? animate(dip, [1, opacityTokens.dip, 1], { duration: duration.short })
        : animate(x, [0, ...[1, -1, 1, -1, 1, -1].map((k) => k * distance.shake), 0], {
            duration: timing.shake,
            ease: ease.inOut,
          });
    };
  });
  useEffect(() => {
    if (!store) return;
    const unsub = store.subscribe(() => tryShake.current());
    tryShake.current();
    return () => {
      unsub();
      playing.current?.stop();
    };
  }, [store]);

  const Comp = (as === "div" ? motion.div : motion.li) as typeof motion.li;
  return (
    <Comp
      layout
      transition={layout}
      variants={variants}
      initial="hidden"
      animate="show"
      exit="gone"
      style={{ ...style, x, opacity: reduced ? dip : undefined }}
      onAnimationComplete={(def) => {
        if (def === "show") {
          rs.clearDelay();
          rs.setEntered(true);
          tryShake.current();
        }
        onAnimationComplete?.(def);
      }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
