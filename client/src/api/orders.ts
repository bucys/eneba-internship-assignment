import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { Money } from "../lib/money";
import { apiFetch, type Paginated } from "./client";

// Mirrors server/app/Http/Resources/OrderItemResource.php. Names and prices are order time snapshots.
export type OrderItem = {
  /** The order_items.id, matched by `OrderItemKeys.order_item_id`. */
  id: number;
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

// Mirrors server/app/Http/Resources/OrderItemKeysResource.php (spec 0010 AC-1).
export type OrderItemKeys = {
  order_item_id: number;
  codes: string[];
};

type OrderKeysBody = { data: OrderItemKeys[] };

export async function getOrderKeys(ulid: string, signal?: AbortSignal) {
  const body = await apiFetch<OrderKeysBody>(
    `/orders/${encodeURIComponent(ulid)}/keys`,
    { signal },
  );
  return body.data;
}

// A sibling of orderQueryKey, never a child, so invalidating an order never refetches codes.
export function orderKeysQueryKey(ulid: string) {
  return ["me", "order-keys", ulid] as const;
}

// gcTime 0: codes leave memory as soon as the order page unmounts (spec 0010 AC-10).
export function orderKeysQuery(ulid: string) {
  return queryOptions({
    queryKey: orderKeysQueryKey(ulid),
    queryFn: ({ signal }) => getOrderKeys(ulid, signal),
    staleTime: Infinity,
    gcTime: 0,
  });
}

// Mirrors server/app/Http/Resources/OrderSummaryResource.php (spec 0011 AC-1). No items, no codes.
export type OrderSummary = {
  ulid: string;
  status: "paid";
  total: Money;
  /** ISO 8601 UTC. */
  paid_at: string;
  /** Sum of quantities: the number of keys. */
  item_count: number;
  /** Number of order lines. */
  line_count: number;
  /** The first item in cart order; both fields are null for an order with no items. */
  first_item: { product_name: string | null; cover_image_url: string | null };
};

export function getOrders(page: number, signal?: AbortSignal) {
  return apiFetch<Paginated<OrderSummary>>(`/orders?page=${page}`, { signal });
}

// A sibling of ["me", "orders", ulid], so invalidating the list never refetches an open order.
export const ORDER_LIST_KEY = ["me", "order-list"] as const;

export function orderListQueryKey(page: number) {
  return [...ORDER_LIST_KEY, page] as const;
}

// keepPreviousData: the current rows stay on screen while the next page loads (AC-4).
export function orderListQuery(page: number) {
  return queryOptions({
    queryKey: orderListQueryKey(page),
    queryFn: ({ signal }) => getOrders(page, signal),
    placeholderData: keepPreviousData,
  });
}
