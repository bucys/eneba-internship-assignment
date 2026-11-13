import { queryOptions } from "@tanstack/react-query";
import type { Money } from "../lib/money";
import { apiFetch } from "./client";

// Mirrors server/app/Http/Resources/OrderItemResource.php. Names and prices are order time snapshots.
export type OrderItem = {
  product: { slug: string; cover_image_url: string };
  product_name: string;
  platform_name: string;
  region_name: string;
  seller_name: string;
  quantity: number;
  unit_price: Money;
  line_total: Money;
};

// Mirrors server/app/Http/Resources/OrderResource.php.
export type Order = {
  ulid: string;
  status: "paid";
  total: Money;
  /** ISO 8601 UTC, for example "2026-11-13T10:24:51Z". */
  paid_at: string;
  items: OrderItem[];
};

export type CheckoutInput = {
  card_number: string;
  card_expiry: string;
  card_cvc: string;
  card_name: string;
  /** The total the buyer saw, in cents. The server only compares it, never charges it. */
  expected_total: number;
};

type OrderBody = { data: Order };

export async function placeOrder(input: CheckoutInput, idempotencyKey: string) {
  const body = await apiFetch<OrderBody>("/checkout", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function getOrder(ulid: string, signal?: AbortSignal) {
  const body = await apiFetch<OrderBody>(
    `/orders/${encodeURIComponent(ulid)}`,
    { signal },
  );
  return body.data;
}

// Under "me", so sign out clears it.
export function orderQueryKey(ulid: string) {
  return ["me", "orders", ulid] as const;
}

export function orderQuery(ulid: string) {
  return queryOptions({
    queryKey: orderQueryKey(ulid),
    queryFn: ({ signal }) => getOrder(ulid, signal),
  });
}
