import { queryOptions } from "@tanstack/react-query";
import type { Money } from "../lib/money";
import { apiFetch, type Paginated } from "./client";

export type ProductType = "game" | "dlc" | "gift_card" | "subscription";

type NamedRef = { slug: string; name: string };

// Mirrors server/app/Http/Resources/ProductResource.php.
export type Product = {
  slug: string;
  name: string;
  type: ProductType;
  cover_image_url: string;
  platform: NamedRef;
  region: NamedRef;
  price: Money | null;
  list_price: Money | null;
  discount_percent: number | null;
};

export function listProducts(page: number, signal?: AbortSignal) {
  return apiFetch<Paginated<Product>>(`/products?page=${page}`, { signal });
}

export function productsQuery(page: number) {
  return queryOptions({
    queryKey: ["products", "list", { page }],
    queryFn: ({ signal }) => listProducts(page, signal),
  });
}
