import { useId, type InputHTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import { describedBy, errorClasses, hintClasses } from "./fieldClasses";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  error?: string;
};

export function Checkbox({
  label,
  hint,
  error,
  id,
  className,
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center gap-3">
        <input
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint && hintId, error && errorId)}
          className={cx(
            "size-5 shrink-0 accent-cta",
            // A native checkbox has no stylable border, so an error shows as a danger
            // outline. Keyboard focus still swaps it for the yellow ring.
            error &&
              "outline-2 outline-offset-2 outline-danger focus-visible:outline-cta",
            className,
          )}
          {...rest}
        />
        <label htmlFor={inputId} className="text-sm text-fg">
          {label}
        </label>
      </div>
      {hint && (
        <p id={hintId} className={hintClasses}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={errorClasses}>
          {error}
        </p>
      )}
    </div>
  );
}
