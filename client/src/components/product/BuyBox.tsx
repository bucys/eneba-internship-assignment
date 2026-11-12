import type { Offer, ProductDetail } from "../../api/products";
import { AddToCartButton } from "../cart/AddToCartButton";
import { BestPriceBadge } from "./BestPriceBadge";
import { Price } from "./Price";

type BuyBoxProps = {
  product: ProductDetail;
  bestOffer: Offer | undefined;
};

// On `surface`, not `panel`: the struck `discount` list price fails AA on `panel` (3.5:1).
export function BuyBox({ product, bestOffer }: BuyBoxProps) {
  if (!bestOffer) {
    return (
      <div className="rounded-sm bg-surface p-5">
        <Price price={null} size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-sm bg-surface p-5">
      <BestPriceBadge />
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
        className="w-full sm:w-auto"
      />
    </div>
  );
}
