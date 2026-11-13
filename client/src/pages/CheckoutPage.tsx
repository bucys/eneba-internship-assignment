import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useRevalidator, useRouteError } from "react-router";
import type { Cart } from "../api/cart";
import { ApiError } from "../api/client";
import { CardPaymentForm } from "../components/checkout/CardPaymentForm";
import { CheckoutPageSkeleton } from "../components/checkout/CheckoutPageSkeleton";
import { CheckoutSummary } from "../components/checkout/CheckoutSummary";
import { Container } from "../components/layout/Container";
import { Alert } from "../components/ui/Alert";
import { LinkButton } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { cartQueryOptions } from "../lib/cart";
import type { CardFormValues } from "../lib/cardInput";
import { checkoutErrorMessage, usePlaceOrder } from "../lib/checkout";
import { formatPrice } from "../lib/money";
import { useSlowPending } from "../lib/useSlowPending";

function CheckoutBody() {
  // Always refetch on mount, so a total cached from /cart is never what the buyer pays against (AC-10).
  const cartQuery = useQuery({ ...cartQueryOptions, refetchOnMount: "always" });
  const {
    mutation: placeOrder,
    isOpeningOrder,
    accountChangedNotice,
  } = usePlaceOrder();
  const isSlow = useSlowPending(cartQuery.isPending);
  // The cart that was paid for. After success the cache holds the empty cart, so this
  // keeps the summary on screen until the confirmation page replaces it.
  const [paidCart, setPaidCart] = useState<Cart | null>(null);

  const { formError, fieldErrors } = useMemo(
    () => (placeOrder.isError ? checkoutErrorMessage(placeOrder.error) : {}),
    [placeOrder.isError, placeOrder.error],
  );

  const cart = isOpeningOrder && paidCart ? paidCart : cartQuery.data;

  if (!cart) {
    if (cartQuery.isError) {
      return <ErrorState onRetry={() => void cartQuery.refetch()} />;
    }
    return (
      <div className="flex flex-col gap-4">
        {isSlow && (
          <Alert role="status">
            Waking up the server. The first visit after a quiet spell can take
            up to a minute.
          </Alert>
        )}
        <CheckoutPageSkeleton />
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        message="Find a game you like and add an offer to your cart."
        action={<LinkButton to="/">Browse games</LinkButton>}
      />
    );
  }

  if (!cart.can_checkout) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert variant="error" role="status">
          Some items are no longer available.
        </Alert>
        <LinkButton to="/cart" variant="secondary">
          Back to cart
        </LinkButton>
      </div>
    );
  }

  function handleSubmit(values: CardFormValues) {
    if (!cart || placeOrder.isPending || isOpeningOrder) return;
    setPaidCart(cart);
    placeOrder.mutate({ ...values, expected_total: cart.total.amount });
  }

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_22rem] md:items-start md:gap-8">
      <CheckoutSummary cart={cart} className="md:col-start-2 md:row-start-1" />
      <div className="flex flex-col gap-4 md:col-start-1 md:row-start-1">
        {accountChangedNotice && (
          <Alert role="status">{accountChangedNotice}</Alert>
        )}
        <CardPaymentForm
          onSubmit={handleSubmit}
          pending={placeOrder.isPending || isOpeningOrder}
          disabled={cartQuery.isFetching}
          fieldErrors={fieldErrors}
          formError={formError}
          totalLabel={formatPrice(cart.total)}
        />
      </div>
    </div>
  );
}

export function CheckoutPage() {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <title>Checkout | Eneba Marketplace (demo)</title>
      <h1 className="text-2xl font-extrabold md:text-3xl">Checkout</h1>
      <CheckoutBody />
    </Container>
  );
}

/** Shown when /me fails for a reason other than 401 (network, timeout, 5xx). */
export function CheckoutErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const message = error instanceof ApiError ? error.message : undefined;

  return (
    <Container className="flex flex-col gap-6 py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">Checkout</h1>
      <ErrorState
        message={message}
        onRetry={() => void revalidator.revalidate()}
      />
    </Container>
  );
}
