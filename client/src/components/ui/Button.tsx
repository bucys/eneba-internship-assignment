import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { Link, type LinkProps } from "react-router";
import { cx } from "../../lib/cx";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-cta text-cta-fg hover:bg-cta-hover",
  secondary: "border border-link bg-transparent text-link hover:bg-surface",
  ghost: "bg-transparent text-fg hover:bg-surface",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-14 px-6 text-base",
};

function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
) {
  return cx(
    "inline-flex items-center justify-center rounded-sm font-extrabold whitespace-nowrap transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  type = "button",
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      type={type}
      className={buttonClasses(
        variant,
        size,
        cx(loading && "cursor-wait", className),
      )}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...rest}
    >
      {/* While loading, the negative margin cancels the spinner's 22px
          (16px icon + 6px gap), so the button keeps the same width. */}
      <span
        className={cx(
          "inline-flex items-center gap-1.5",
          loading && "-mx-2.75",
        )}
      >
        {loading && <Spinner />}
        {children}
      </span>
    </button>
  );
}

type LinkButtonProps = LinkProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={buttonClasses(
        variant,
        size,
        typeof className === "string" ? className : undefined,
      )}
      {...rest}
    />
  );
}
