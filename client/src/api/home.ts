import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Product } from "./products";

// Mirrors server/app/Http/Resources/HomeBlockResource.php. `type` stays a plain string,
// so a block type this client does not know yet is skipped, not a type error.
export type HomeBlock = { type: string; title: string };

// Mirrors server/app/Http/Resources/BannerResource.php.
export type Banner = {
  id: number;
  title: string;
  tagline: string;
  cta_label: string;
  image_url: string;
  product: Product;
};

const HOME_STALE_TIME = 60_000;

function homeQuery<T>(key: string, path: string) {
  return queryOptions({
    queryKey: ["home", key],
    queryFn: ({ signal }) => apiFetch<{ data: T[] }>(path, { signal }),
    select: (response) => response.data,
    staleTime: HOME_STALE_TIME,
  });
}

export function homeLayoutQuery() {
  return homeQuery<HomeBlock>("layout", "/home");
}

export function homeBannersQuery() {
  return homeQuery<Banner>("banners", "/home/banners");
}

export function bestSellersQuery() {
  return homeQuery<Product>("best-sellers", "/home/best-sellers");
}

export function dealsQuery() {
  return homeQuery<Product>("deals", "/home/deals");
}
