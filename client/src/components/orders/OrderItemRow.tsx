import type { ReactNode } from "react";
import { Link } from "react-router";
import type { OrderItem } from "../../api/orders";
import { formatPrice } from "../../lib/money";
import { CoverImage } from "../product/CoverImage";
import { Price } from "../product/Price";

type OrderItemRowProps = {
  item: OrderItem;
  /** The key slots, shown under the details. */
  children?: ReactNode;
};

export function OrderItemRow({ item, children }: OrderItemRowProps) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 rounded-sm bg-surface p-4">
      <div className="w-16 self-start sm:row-span-2 md:w-20">
        <CoverImage url={item.product.cover_image_url} alt="" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
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
          <Price price={item.line_total} />
        </div>
      </div>
      {/* Full card width below sm, so a key fits on one line on narrow phones. */}
      {children && (
        <div className="col-span-2 sm:col-span-1 sm:col-start-2 sm:mt-1">
          {children}
        </div>
      )}
    </li>
  );
}
