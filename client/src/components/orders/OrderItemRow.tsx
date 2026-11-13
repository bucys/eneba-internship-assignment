import { Link } from "react-router";
import type { OrderItem } from "../../api/orders";
import { formatPrice } from "../../lib/money";
import { CoverImage } from "../product/CoverImage";

type OrderItemRowProps = {
  item: OrderItem;
};

// Feature 11 adds the key list under each row.
export function OrderItemRow({ item }: OrderItemRowProps) {
  return (
    <li className="flex gap-4 rounded-sm bg-surface p-4">
      <div className="w-16 shrink-0 self-start md:w-20">
        <CoverImage url={item.product.cover_image_url} alt="" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          to={`/products/${item.product.slug}`}
          className="font-semibold wrap-break-word text-fg transition-colors hover:text-cta"
        >
          {item.product_name}
        </Link>
        <span className="text-sm text-fg-muted">
          {item.platform_name} · {item.region_name}
        </span>
        <span className="text-sm text-fg-soft">
          Sold by{" "}
          <span className="font-semibold text-fg">{item.seller_name}</span>
        </span>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-sm text-fg-muted">
            {item.quantity} × {formatPrice(item.unit_price)}
          </span>
          <span className="font-extrabold text-price">
            {formatPrice(item.line_total)}
          </span>
        </div>
      </div>
    </li>
  );
}
