import { Check } from "lucide-react";
import { Link } from "react-router";
import { cx } from "../../lib/cx";

export type CheckoutStep = 1 | 2 | 3;

const STEPS = [
  { step: 1, label: "Cart" },
  { step: 2, label: "Payment" },
  { step: 3, label: "Done" },
] as const;

type StepperProps = {
  current: CheckoutStep;
};

/**
 * Cart, Payment, Done (spec 0015 AC-18). Below sm only the current step shows its label;
 * the others keep it for screen readers.
 */
export function Stepper({ current }: StepperProps) {
  return (
    <ol
      aria-label="Checkout progress"
      className="flex items-center gap-1 sm:gap-2"
    >
      {STEPS.map(({ step, label }, index) => {
        const isDone = step < current;
        const isCurrent = step === current;
        const content = (
          <>
            <span
              aria-hidden="true"
              className={cx(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-extrabold sm:size-8",
                isCurrent && "border-cta bg-cta text-cta-fg",
                isDone && "border-success text-success",
                !isDone && !isCurrent && "border-fg-muted text-fg-muted",
              )}
            >
              {isDone ? <Check className="size-4" strokeWidth={3} /> : step}
            </span>
            <span
              className={cx(
                "text-sm",
                isCurrent ? "font-extrabold text-fg" : "sr-only sm:not-sr-only",
                isDone && "font-semibold text-fg-soft",
                !isDone && !isCurrent && "text-fg-muted",
              )}
            >
              {label}
              {isDone && <span className="sr-only">, completed</span>}
            </span>
          </>
        );

        return (
          <li
            key={step}
            aria-current={isCurrent ? "step" : undefined}
            className="flex items-center gap-1 sm:gap-2"
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className={cx(
                  "h-0.5 w-3 sm:w-10",
                  step <= current ? "bg-success" : "bg-fg-muted",
                )}
              />
            )}
            {isDone && step === 1 && current === 2 ? (
              <Link
                to="/cart"
                className="flex min-h-11 items-center gap-2 rounded-sm transition-colors hover:text-cta"
              >
                {content}
              </Link>
            ) : (
              <span className="flex min-h-11 items-center gap-2">
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
