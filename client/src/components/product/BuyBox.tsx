import type { ProductDetail } from "../../api/products";
import { formatPrice } from "../../lib/money";
import { otherOffersSummary } from "../../pages/productPageView";
import { AddToCartButton } from "../cart/AddToCartButton";
import { Price } from "./Price";

type BuyBoxProps = {
  product: ProductDetail;
};

/** Best offer, its seller, add to cart, and a jump to the other offers (spec 0015 AC-16). */
export function BuyBox({ product }: BuyBoxProps) {
  const bestOffer = product.offers.find(
    (offer) => offer.id === product.best_offer_id,
  );

  if (!bestOffer) {
    return (
      <div className="rounded-sm bg-surface p-5">
        <Price price={null} size="lg" />
      </div>
    );
  }

  const others = otherOffersSummary(product.offers, product.best_offer_id);

  return (
    <div className="flex flex-col items-stretch gap-3 rounded-sm bg-surface p-5">
      <p className="text-xs font-extrabold text-accent uppercase">Best offer</p>
      <Price
        price={product.price}
        listPrice={product.list_price}
        discountPercent={product.discount_percent}
        size="lg"
      />
      <p className="text-sm text-fg-soft">
        Sold by{" "}
        <span className="font-semibold text-fg">{bestOffer.seller.name}</span>
      </p>
      <AddToCartButton
        offerId={bestOffer.id}
        stock={bestOffer.stock}
        context={`from ${bestOffer.seller.name}, best price`}
        size="lg"
        className="w-full"
      />
      {others && (
        <a
          href="#offers"
          className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-link transition-colors hover:text-cta"
        >
          {`+${others.count} ${others.count === 1 ? "offer" : "offers"} from ${formatPrice(others.lowest)}`}
        </a>
      )}
    </div>
  );
}
