import { cx } from "../../lib/cx";
import { formatPrice, type Money } from "../../lib/money";

type PriceSize = "md" | "lg";

type PriceProps = {
  price: Money | null;
  listPrice?: Money | null;
  discountPercent?: number | null;
  size?: PriceSize;
};

const currentSizeClasses: Record<PriceSize, string> = {
  md: "text-base",
  lg: "text-2xl",
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
}: PriceProps) {
  if (price === null) {
    return <span className="text-sm text-fg-muted">Out of stock</span>;
  }

  const showDiscount =
    discountPercent !== null && discountPercent > 0 && listPrice !== null;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={cx("font-extrabold text-price", currentSizeClasses[size])}
      >
        {formatPrice(price)}
      </span>
      {showDiscount && (
        <>
          <s className={cx("text-discount", listSizeClasses[size])}>
            <span className="sr-only">was </span>
            {formatPrice(listPrice)}
          </s>
          <span className="rounded-sm bg-discount-bg px-1.5 py-0.5 text-xs font-extrabold text-cta-fg">
            {`-${discountPercent}%`}
          </span>
        </>
      )}
    </span>
  );
}
