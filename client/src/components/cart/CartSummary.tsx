import type { Cart } from "../../api/cart";
import { Price } from "../product/Price";
import { Button, LinkButton } from "../ui/Button";

type CartSummaryProps = {
  cart: Cart;
};

const BLOCKED_NOTE_ID = "checkout-blocked-note";

function itemsText(count: number) {
  return count === 1 ? "1 item" : `${count} items`;
}

export function CartSummary({ cart }: CartSummaryProps) {
  return (
    <section
      aria-labelledby="cart-summary-heading"
      className="flex flex-col gap-4 rounded-sm bg-surface p-5 md:sticky md:top-24"
    >
      <h2 id="cart-summary-heading" className="text-xl font-extrabold">
        Summary
      </h2>
      <p className="text-sm text-fg-soft">{itemsText(cart.item_count)}</p>
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-semibold">Total</span>
        <Price price={cart.total} size="lg" />
      </div>
      {cart.can_checkout ? (
        <LinkButton to="/checkout" size="lg" className="w-full">
          Checkout
        </LinkButton>
      ) : (
        <>
          <Button
            size="lg"
            disabled
            aria-describedby={BLOCKED_NOTE_ID}
            className="w-full"
          >
            Checkout
          </Button>
          <p id={BLOCKED_NOTE_ID} className="text-sm text-fg-soft">
            Remove unavailable items to continue.
          </p>
        </>
      )}
    </section>
  );
}
