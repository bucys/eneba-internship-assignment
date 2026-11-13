import type { Cart } from "../../api/cart";
import { cx } from "../../lib/cx";
import { Price } from "../product/Price";
import { CheckoutLineRow } from "./CheckoutLineRow";

type CheckoutSummaryProps = {
  cart: Cart;
  className?: string;
};

function itemsText(count: number) {
  return count === 1 ? "1 item" : `${count} items`;
}

export function CheckoutSummary({ cart, className }: CheckoutSummaryProps) {
  return (
    <section
      aria-labelledby="checkout-summary-heading"
      className={cx(
        "flex flex-col gap-4 rounded-sm bg-surface p-5 md:sticky md:top-24",
        className,
      )}
    >
      <h2 id="checkout-summary-heading" className="text-xl font-extrabold">
        Order summary
      </h2>
      <ul aria-label="Items" className="flex flex-col gap-4">
        {cart.lines.map((line) => (
          <CheckoutLineRow key={line.offer_id} line={line} />
        ))}
      </ul>
      <p className="text-sm text-fg-soft">{itemsText(cart.item_count)}</p>
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-semibold">Total</span>
        <Price price={cart.total} size="lg" />
      </div>
    </section>
  );
}
