import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../api/client";
import { orderQueryKey, placeOrder, type CheckoutInput } from "../api/orders";
import { authToken } from "./authToken";
import { CART_KEY, EMPTY_CART } from "./cart";
import { CARD_FIELDS, type CardFieldErrors } from "./cardInput";
import { queryClient } from "./queryClient";

export const PAYMENT_FAILED = "Payment failed. Please try again.";
export const PAYMENT_UNREACHABLE =
  "We could not reach the payment service. Please try again.";

export type CheckoutErrorView = {
  formError?: string;
  fieldErrors?: CardFieldErrors;
};

function isCardField(key: string): key is (typeof CARD_FIELDS)[number] {
  return (CARD_FIELDS as readonly string[]).includes(key);
}

function secondsText(seconds: number) {
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
}

/** Where each checkout failure shows on the page (spec 0009 AC-13). */
export function checkoutErrorMessage(error: unknown): CheckoutErrorView {
  if (!(error instanceof ApiError)) return { formError: PAYMENT_FAILED };

  if (error.kind === "network" || error.kind === "timeout") {
    return { formError: PAYMENT_UNREACHABLE };
  }
  if (error.status === 409) return { formError: error.message };
  if (error.status === 429) {
    return {
      formError: `Too many payment attempts. Try again in ${secondsText(error.retryAfter ?? 60)}.`,
    };
  }
  if (error.status !== 422) return { formError: PAYMENT_FAILED };

  const errors = error.errors ?? {};
  if (errors.payment?.[0]) return { formError: errors.payment[0] };
  // The cart refetch shows the empty state; there is nothing to say on the form.
  if (errors.cart) return {};

  const fieldErrors: CardFieldErrors = {};
  let hasOtherKey = false;
  for (const [key, messages] of Object.entries(errors)) {
    if (isCardField(key) && messages[0]) {
      fieldErrors[key] = messages[0];
    } else {
      hasOtherKey = true;
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  return {
    fieldErrors: hasFieldErrors ? fieldErrors : undefined,
    formError: hasOtherKey || !hasFieldErrors ? PAYMENT_FAILED : undefined,
  };
}

/** A 409 or a 422 on `cart` means the cart the buyer saw is stale. */
export function shouldRefetchCart(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 409 ||
      (error.status === 422 && error.errors?.cart !== undefined))
  );
}

/**
 * One idempotency key per page mount, sent on every attempt from that visit (AC-13).
 * Caches are written only while the token the request started with is still signed in.
 */
export function usePlaceOrder() {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: CheckoutInput) => {
      const token = authToken.get();
      const order = await placeOrder(input, idempotencyKey);
      return { order, token };
    },
    onSuccess: ({ order, token }) => {
      if (authToken.get() !== token) return;
      queryClient.setQueryData(CART_KEY, EMPTY_CART);
      queryClient.setQueryData(orderQueryKey(order.ulid), order);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void navigate(`/orders/${order.ulid}`, { replace: true });
    },
    onError: (error) => {
      if (shouldRefetchCart(error)) {
        void queryClient.invalidateQueries({ queryKey: CART_KEY });
      }
    },
  });
}
