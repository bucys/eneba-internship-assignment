import { Link } from "react-router";
import type { OrderSummary } from "../../api/orders";
import {
  ORDER_STATUS_LABEL,
  itemCountLabel,
  moreProductsLabel,
  shortOrderNumber,
} from "../../lib/orderHistory";
import { CoverImage } from "../product/CoverImage";
import { Price } from "../product/Price";

/** Checkout never makes an itemless order, but the API allows a null first item. */
const UNKNOWN_PRODUCT = "Unknown product";

const paidDateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

type OrderSummaryRowProps = {
  order: OrderSummary;
  /** The list page this row sits on, so the order page can link back to it. */
  fromPage: number;
};

export function OrderSummaryRow({ order, fromPage }: OrderSummaryRowProps) {
  const more = moreProductsLabel(order.line_count);

  return (
    <li>
      <Link
        to={`/orders/${order.ulid}`}
        state={{ fromPage }}
        className="flex gap-4 rounded-sm bg-surface p-4 transition-colors hover:bg-surface-deep"
      >
        <div className="w-14 shrink-0 self-start md:w-16">
          <CoverImage url={order.first_item.cover_image_url} alt="" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-semibold wrap-break-word text-fg">
            {order.first_item.product_name ?? UNKNOWN_PRODUCT}
            {more && <span className="font-normal text-fg-soft"> {more}</span>}
          </span>
          <span className="text-sm text-fg-muted">
            {itemCountLabel(order.item_count)} ·{" "}
            <time dateTime={order.paid_at}>
              {paidDateFormat.format(new Date(order.paid_at))}
            </time>{" "}
            · {shortOrderNumber(order.ulid)}
          </span>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="rounded-sm border border-success px-2 py-0.5 text-xs font-semibold text-success">
              {ORDER_STATUS_LABEL[order.status]}
            </span>
            <Price price={order.total} />
          </div>
        </div>
      </Link>
    </li>
  );
}
