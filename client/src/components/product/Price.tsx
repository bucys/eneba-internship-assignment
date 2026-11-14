import { cx } from "../../lib/cx";
import { formatPrice, type Money } from "../../lib/money";

type PriceSize = "md" | "lg";

type PriceProps = {
  price: Money | null;
  listPrice?: Money | null;
  discountPercent?: number | null;
  size?: PriceSize;
  className?: string;
};

const currentSizeClasses: Record<PriceSize, string> = {
  md: "text-lg",
  lg: "text-3xl",
};

const listSizeClasses: Record<PriceSize, string> = {
  md: "text-xs",
  lg: "text-sm",
};

export function Price({
  price,
  listPrice = null,
  discountPercent = null,
  size = "md",
  className,
}: PriceProps) {
  if (price === null) {
    return (
      <span className={cx("text-sm text-fg-muted", className)}>
        Out of stock
      </span>
    );
  }

  const showDiscount =
    discountPercent !== null && discountPercent > 0 && listPrice !== null;

  return (
    <span className={cx("inline-flex flex-col", className)}>
      {showDiscount && (
        <span
          className={cx("flex items-baseline gap-2", listSizeClasses[size])}
        >
          <s className="text-fg-muted">
            <span className="sr-only">was </span>
            {formatPrice(listPrice)}
          </s>
          <span className="font-extrabold text-saving">{`-${discountPercent}%`}</span>
        </span>
      )}
      <span
        className={cx(
          "leading-tight font-extrabold text-fg",
          currentSizeClasses[size],
        )}
      >
        {formatPrice(price)}
      </span>
    </span>
  );
}
