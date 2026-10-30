import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  /** Visible label, tied to the input by `id`. */
  label: string;
  id: string;
  /** Decorative text inside the field, before the value (for example "@"). */
  prefix?: ReactNode;
  /** Fixed-size slot after the value (status icons). Its space is always reserved. */
  trailing?: ReactNode;
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
  wrapperClassName?: string;
};

/** Labelled text field. The wrapper shows focus and error state; the input itself is bare. */
export function Input({
  label,
  id,
  prefix,
  trailing,
  invalid,
  ref,
  className,
  wrapperClassName,
  ...rest
}: InputProps) {
  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <div
        className={cn(
          "flex h-12 items-center gap-1 rounded-2xl border bg-surface px-4 transition-[border-color,background-color] focus-within:ring-2 focus-within:ring-accent",
          invalid ? "border-danger" : "border-border-strong focus-within:border-accent",
        )}
      >
        {prefix != null && (
          <span aria-hidden="true" className="select-none text-fg-muted">
            {prefix}
          </span>
        )}
        <input
          id={id}
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-base text-fg outline-none! placeholder:text-fg-muted",
            className,
          )}
          {...rest}
        />
        {trailing !== undefined && (
          <span className="grid h-6 w-6 shrink-0 place-items-center">{trailing}</span>
        )}
      </div>
    </div>
  );
}
