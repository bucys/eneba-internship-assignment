import type { Money } from "../lib/money";
import { apiFetch } from "./client";

type NamedRef = { slug: string; name: string };

// Mirrors server/app/Http/Resources/CartLineResource.php.
export type CartLine = {
  offer_id: number;
  quantity: number;
  max_quantity: number;
  available: boolean;
  quantity_reduced: boolean;
  unit_price: Money;
  line_total: Money | null;
  seller: { name: string };
  product: {
    slug: string;
    name: string;
    cover_image_url: string;
    platform: NamedRef;
    region: NamedRef;
  };
};

// Mirrors server/app/Http/Resources/CartResource.php.
export type Cart = {
  lines: CartLine[];
  item_count: number;
  total: Money;
  can_checkout: boolean;
};

/** One guest cart line, as stored in localStorage and sent to preview and merge. */
export type CartLineInput = {
  offer_id: number;
  quantity: number;
};

type CartBody = { data: Cart };

async function cartRequest(path: string, init: RequestInit = {}) {
  const body = await apiFetch<CartBody>(path, init);
  return body.data;
}

export function fetchCart(signal?: AbortSignal) {
  return cartRequest("/cart", { signal });
}

export function previewCart(items: CartLineInput[], signal?: AbortSignal) {
  return cartRequest("/cart/preview", {
    method: "POST",
    body: JSON.stringify({ items }),
    signal,
  });
}

export function mergeCart(items: CartLineInput[]) {
  return cartRequest("/cart/merge", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function addCartItem(offerId: number) {
  return cartRequest("/cart/items", {
    method: "POST",
    body: JSON.stringify({ offer_id: offerId }),
  });
}

export function updateCartItem(offerId: number, quantity: number) {
  return cartRequest(`/cart/items/${offerId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(offerId: number) {
  return cartRequest(`/cart/items/${offerId}`, { method: "DELETE" });
}
