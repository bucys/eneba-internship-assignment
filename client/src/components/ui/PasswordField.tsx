import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";
import {
  controlClasses,
  describedBy,
  errorClasses,
  hintClasses,
  labelClasses,
} from "./fieldClasses";

type PasswordFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  hint?: string;
  error?: string;
};

export function PasswordField({
  label,
  hint,
  error,
  id,
  className,
  ...rest
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={labelClasses}>
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint && hintId, error && errorId)}
          className={controlClasses(Boolean(error), `pr-12 ${className ?? ""}`)}
          {...rest}
        />
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={visible}
          aria-controls={inputId}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-sm text-fg-soft transition-colors hover:text-fg"
        >
          <Icon aria-hidden="true" className="size-5" />
        </button>
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
