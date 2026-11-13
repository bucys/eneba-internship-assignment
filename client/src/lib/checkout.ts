import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, type NavigateFunction } from "react-router";
import { ApiError } from "../api/client";
import {
  ORDER_LIST_KEY,
  orderQueryKey,
  placeOrder,
  type CheckoutInput,
  type Order,
} from "../api/orders";
import { useAuthToken } from "./auth";
import { authToken } from "./authToken";
import { CART_KEY, EMPTY_CART } from "./cart";
import { CARD_FIELDS, type CardFieldErrors } from "./cardInput";
import { queryClient } from "./queryClient";
import { secondsText } from "./format";

export const PAYMENT_FAILED = "Payment failed. Please try again.";
export const PAYMENT_UNREACHABLE =
  "We could not reach the payment service. Please try again.";
export const ACCOUNT_CHANGED_NOTICE =
  "Your account changed while the payment was processing. It may have completed under the previous account, so check that account's orders before you pay again.";

export type CheckoutErrorView = {
  formError?: string;
  fieldErrors?: CardFieldErrors;
};

function isCardField(key: string): key is (typeof CARD_FIELDS)[number] {
  return (CARD_FIELDS as readonly string[]).includes(key);
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

export type PlacedOrder = { order: Order; token: string | null };

/**
 * True while a paid order is about to open its confirmation page, so the form stays locked.
 * False when the token changed mid request: onSuccess skipped the navigation, and the form
 * must unlock instead of showing "Processing payment" forever.
 */
export function isOpeningOrder(
  result: { isSuccess: boolean; data?: PlacedOrder },
  currentToken: string | null,
): boolean {
  return result.isSuccess && result.data?.token === currentToken;
}

/** Shown when a payment succeeded but the token changed mid request (the form unlocks instead). */
export function accountChangedNotice(
  result: { isSuccess: boolean; data?: PlacedOrder },
  currentToken: string | null,
): string | undefined {
  return result.isSuccess && !isOpeningOrder(result, currentToken)
    ? ACCOUNT_CHANGED_NOTICE
    : undefined;
}

/**
 * Caches are written only while the token the request started with is still signed in.
 * Kept apart from the hook so tests can run it without rendering React.
 */
export function placeOrderOptions(
  idempotencyKey: string,
  navigate: NavigateFunction,
): UseMutationOptions<PlacedOrder, unknown, CheckoutInput> {
  return {
    mutationFn: async (input) => {
      const token = authToken.get();
      const order = await placeOrder(input, idempotencyKey);
      return { order, token };
    },
    onSuccess: ({ order, token }) => {
      if (authToken.get() !== token) return;
      queryClient.setQueryData(CART_KEY, EMPTY_CART);
      queryClient.setQueryData(orderQueryKey(order.ulid), order);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ORDER_LIST_KEY });
      // justPaid tells the order page to say "Payment successful" (spec 0011 AC-7).
      void navigate(`/orders/${order.ulid}`, {
        replace: true,
        state: { justPaid: true },
      });
    },
    onError: (error) => {
      if (shouldRefetchCart(error)) {
        void queryClient.invalidateQueries({ queryKey: CART_KEY });
      }
    },
  };
}

/** One idempotency key per page mount, sent on every attempt from that visit (AC-13). */
export function usePlaceOrder() {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const navigate = useNavigate();
  const token = useAuthToken();
  const mutation = useMutation(placeOrderOptions(idempotencyKey, navigate));

  return {
    mutation,
    isOpeningOrder: isOpeningOrder(mutation, token),
    accountChangedNotice: accountChangedNotice(mutation, token),
  };
}
