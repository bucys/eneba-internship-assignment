import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "./client";

export type FilterOption = { slug: string; name: string };

// Mirrors server/app/Http/Resources/CatalogFiltersResource.php.
export type CatalogFilters = {
  platforms: FilterOption[];
  regions: FilterOption[];
};

export function getCatalogFilters(signal?: AbortSignal) {
  return apiFetch<{ data: CatalogFilters }>("/catalog/filters", { signal });
}

/** Outside the "products" prefix, so a purchase's invalidation does not refetch it. */
export function catalogFiltersQuery() {
  return queryOptions({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => getCatalogFilters(signal),
    staleTime: 60 * 60 * 1000,
  });
}
