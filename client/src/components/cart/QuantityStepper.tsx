import { Minus, Plus } from "lucide-react";
import { cx } from "../../lib/cx";

type QuantityStepperProps = {
  value: number;
  max: number;
  /** The product name, used in the accessible names. */
  itemName: string;
  disabled?: boolean;
  onChange: (quantity: number) => void;
};

const stepButtonClasses =
  "inline-flex size-11 items-center justify-center text-fg transition-colors hover:bg-surface-deep aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent";

// aria-disabled (not disabled) keeps focus on the button when it reaches a limit.
export function QuantityStepper({
  value,
  max,
  itemName,
  disabled = false,
  onChange,
}: QuantityStepperProps) {
  const canDecrease = !disabled && value > 1;
  const canIncrease = !disabled && value < max;

  return (
    <div
      role="group"
      aria-label={`Quantity for ${itemName}`}
      className="inline-flex items-center overflow-hidden rounded-sm border border-fg-muted"
    >
      <button
        type="button"
        aria-label={`Decrease quantity of ${itemName}`}
        aria-disabled={!canDecrease || undefined}
        onClick={() => canDecrease && onChange(value - 1)}
        className={stepButtonClasses}
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <span
        aria-live="polite"
        className={cx(
          "min-w-8 text-center font-semibold",
          disabled && "text-fg-muted",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase quantity of ${itemName}`}
        aria-disabled={!canIncrease || undefined}
        onClick={() => canIncrease && onChange(value + 1)}
        className={stepButtonClasses}
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
