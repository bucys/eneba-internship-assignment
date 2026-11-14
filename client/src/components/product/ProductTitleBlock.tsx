import type { ReactNode } from "react";
import { PRODUCT_TYPE_LABELS, type ProductDetail } from "../../api/products";
import { CoverImage } from "./CoverImage";

type ProductTitleBlockProps = {
  product: ProductDetail;
  // The page owns its <h1>, so it passes the name heading in.
  heading: ReactNode;
};

/** The cover beside the type, name, platform and region (spec 0015 AC-15). */
export function ProductTitleBlock({
  product,
  heading,
}: ProductTitleBlockProps) {
  return (
    <div className="flex gap-4 md:gap-6">
      <div className="w-28 shrink-0 self-start md:w-44">
        <CoverImage
          key={product.cover_image_url}
          url={product.cover_image_url}
          alt={product.name}
          loading="eager"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm font-semibold text-fg-soft">
          {PRODUCT_TYPE_LABELS[product.type]}
        </p>
        {heading}
        <p className="text-sm font-extrabold text-accent uppercase">
          {product.platform.name} · {product.region.name}
        </p>
      </div>
    </div>
  );
}
