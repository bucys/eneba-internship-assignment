import type { CartLine } from "../../api/cart";
import { formatPrice } from "../../lib/money";
import { CoverImage } from "../product/CoverImage";

type CheckoutLineRowProps = {
  line: CartLine;
};

export function CheckoutLineRow({ line }: CheckoutLineRowProps) {
  const { product } = line;

  return (
    <li className="flex gap-3">
      <div className="w-12 shrink-0 self-start">
        <CoverImage url={product.cover_image_url} alt="" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
        <span className="font-semibold wrap-break-word text-fg">
          {product.name}
        </span>
        <span className="text-fg-muted">
          {product.platform.name} · {product.region.name}
        </span>
        <span className="text-fg-soft">
          Sold by{" "}
          <span className="font-semibold text-fg">{line.seller.name}</span>
        </span>
        {line.quantity_reduced && (
          <span className="text-fg-soft">
            Only {line.quantity} available, so we lowered the quantity.
          </span>
        )}
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-fg-muted">
            {line.quantity} × {formatPrice(line.unit_price)}
          </span>
          {line.line_total && (
            <span className="font-extrabold text-price">
              {formatPrice(line.line_total)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
