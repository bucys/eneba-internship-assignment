import { useEffect, useRef, type RefObject } from "react";
import { CartLineRow } from "../components/cart/CartLineRow";
import { CartPageSkeleton } from "../components/cart/CartPageSkeleton";
import { CartSummary } from "../components/cart/CartSummary";
import { Container } from "../components/layout/Container";
import { Alert } from "../components/ui/Alert";
import { LinkButton } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { useCart } from "../lib/cart";
import { focusAfterRemove, type RemovedLine } from "../lib/cartFocus";
import { useSlowPending } from "../lib/useSlowPending";

type CartBodyProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
};

function CartBody({ headingRef }: CartBodyProps) {
  const { cart, isError, isFetching, refetch } = useCart();
  const isSlow = useSlowPending(isFetching && !cart);
  const listRef = useRef<HTMLUListElement>(null);
  // Set before the request, because a guest remove re-renders before it resolves.
  const removedRef = useRef<RemovedLine | null>(null);

  // The removed row unmounts with its focused button, so hand focus to a nearby control (AC-15).
  useEffect(() => {
    const removed = removedRef.current;
    if (!removed || !cart) return;
    const target = focusAfterRemove(
      cart.lines.map((line) => line.offer_id),
      removed,
    );
    if (target === null) return;
    removedRef.current = null;
    if (target === "heading") {
      headingRef.current?.focus();
    } else {
      listRef.current
        ?.querySelectorAll<HTMLButtonElement>("[data-cart-remove]")
        [target]?.focus();
    }
  }, [cart, headingRef]);

  if (cart) {
    if (cart.lines.length === 0) {
      return (
        <EmptyState
          title="Your cart is empty"
          message="Find a game you like and add an offer to your cart."
          action={<LinkButton to="/">Browse games</LinkButton>}
        />
      );
    }
    return (
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
        <ul
          ref={listRef}
          aria-label="Cart items"
          className="flex flex-col gap-2"
        >
          {cart.lines.map((line, index) => (
            <CartLineRow
              key={line.offer_id}
              line={line}
              onRemoveStart={() => {
                removedRef.current = { offerId: line.offer_id, index };
              }}
              onRemoveFail={() => {
                removedRef.current = null;
              }}
            />
          ))}
        </ul>
        <CartSummary cart={cart} />
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {isSlow && (
        <Alert role="status">
          Waking up the server. The first visit after a quiet spell can take up
          to a minute.
        </Alert>
      )}
      <CartPageSkeleton />
    </div>
  );
}

export function CartPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  return (
    <Container className="flex flex-col gap-6 py-10">
      <title>Cart | Eneba Marketplace (demo)</title>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-extrabold md:text-3xl"
      >
        Cart
      </h1>
      <CartBody headingRef={headingRef} />
    </Container>
  );
}
