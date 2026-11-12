import type { ReactNode } from "react";
import { PRODUCT_TYPE_LABELS, type ProductDetail } from "../../api/products";
import { BuyBox } from "./BuyBox";
import { CoverImage } from "./CoverImage";

type ProductHeroProps = {
  product: ProductDetail;
  // The page owns its <h1>, so it passes the name heading in.
  heading: ReactNode;
};

export function ProductHero({ product, heading }: ProductHeroProps) {
  const bestOffer = product.offers.find(
    (offer) => offer.id === product.best_offer_id,
  );

  return (
    <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8">
      <CoverImage
        key={product.cover_image_url}
        url={product.cover_image_url}
        alt={product.name}
        loading="eager"
        className="max-w-48 md:max-w-none"
      />
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-fg-soft">
            {PRODUCT_TYPE_LABELS[product.type]}
          </p>
          {heading}
          <p className="text-fg-soft">
            {product.platform.name} · {product.region.name}
          </p>
        </div>
        <div className="md:max-w-sm">
          <BuyBox product={product} bestOffer={bestOffer} />
        </div>
      </div>
    </div>
  );
}
