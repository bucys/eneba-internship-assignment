import type { Offer } from "../../api/products";
import { cx } from "../../lib/cx";
import { AddToCartButton } from "../cart/AddToCartButton";
import { formatCount, formatRating } from "../../lib/format";
import { BestPriceBadge } from "./BestPriceBadge";
import { Price } from "./Price";

const LOW_STOCK_THRESHOLD = 5;

type OfferRowProps = {
  offer: Offer;
  isBest: boolean;
};

function ratingText({ rating_basis_points, rating_count }: Offer["seller"]) {
  if (rating_count === 0) {
    return "New seller";
  }
  const noun = rating_count === 1 ? "rating" : "ratings";
  return `${formatRating(rating_basis_points)} · ${formatCount(rating_count)} ${noun}`;
}

export function OfferRow({ offer, isBest }: OfferRowProps) {
  const inStock = offer.stock > 0;
  const isLowStock = inStock && offer.stock <= LOW_STOCK_THRESHOLD;

  return (
    <li className="flex flex-col gap-3 rounded-sm bg-surface p-4 md:flex-row md:items-center md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cx(
              "font-semibold break-words",
              inStock ? "text-fg" : "text-fg-muted",
            )}
          >
            {offer.seller.name}
          </span>
          {isBest && <BestPriceBadge />}
        </div>
        <span className="text-sm text-fg-muted">
          {ratingText(offer.seller)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 md:contents">
        <span className="text-sm font-semibold text-fg-soft md:w-28">
          {isLowStock && `Only ${offer.stock} left`}
        </span>
        <div className="md:w-32 md:text-right">
          <Price price={inStock ? offer.price : null} />
        </div>
      </div>
      {/* Out of stock rows keep the column on md so prices stay aligned. */}
      <div className={cx("md:w-40 md:shrink-0", !inStock && "hidden md:block")}>
        {inStock && (
          <AddToCartButton
            offerId={offer.id}
            stock={offer.stock}
            context={`from ${offer.seller.name}`}
            className="w-full"
          />
        )}
      </div>
    </li>
  );
}
