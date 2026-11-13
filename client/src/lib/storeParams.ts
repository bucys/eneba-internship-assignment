import { ApiError } from "../api/client";
import { secondsText } from "./format";
import { parsePageParam } from "./orderHistory";

export type StoreSort = "relevance" | "name" | "price_asc" | "price_desc";

export const STORE_SORTS: { value: StoreSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "name", label: "Name: A to Z" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

/** The store's whole state, read from the URL (spec 0012 AC-5). Prices are whole euros. */
export type StoreParams = {
  q: string;
  platform: string[];
  region: string[];
  priceMin: number | null;
  priceMax: number | null;
  sort: StoreSort;
  page: number;
};

export const DEFAULT_STORE_PARAMS: StoreParams = {
  q: "",
  platform: [],
  region: [],
  priceMin: null,
  priceMax: null,
  sort: "name",
  page: 1,
};

export const STORE_PATH = "/store";

export const MAX_PRICE_EUROS = 10_000;

/** Same pattern as server/app/Http/Requests/Catalog/ListProductsRequest.php. */
const PRICE_PATTERN = /^(0|[1-9]\d{0,4})$/;

/** A whole euro amount from 0 to 10000, else null. */
export function parsePrice(raw: string | null): number | null {
  if (raw === null || !PRICE_PATTERN.test(raw)) return null;
  const euros = Number(raw);
  return euros <= MAX_PRICE_EUROS ? euros : null;
}

function parseList(raw: string | null): string[] {
  if (raw === null) return [];
  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  return [...new Set(items)];
}

function isStoreSort(value: string | null): value is StoreSort {
  return STORE_SORTS.some((sort) => sort.value === value);
}

/** Best match first with a search, A to Z without one (spec 0013 AC-11). */
export function defaultSort(q: string): StoreSort {
  return q === "" ? "name" : "relevance";
}

/** The sort select's options: Relevance only means something with a search. */
export function sortOptions(q: string): typeof STORE_SORTS {
  return q === ""
    ? STORE_SORTS.filter((sort) => sort.value !== "relevance")
    : STORE_SORTS;
}

/** Relevance without a search reads as the default, so it never reaches a URL. */
function effectiveSort(q: string, sort: StoreSort | null): StoreSort {
  if (sort === null || (sort === "relevance" && q === ""))
    return defaultSort(q);
  return sort;
}

export function parseStoreParams(search: URLSearchParams): StoreParams {
  const q = (search.get("q") ?? "").trim();
  const sort = search.get("sort");

  return {
    q,
    platform: parseList(search.get("platform")),
    region: parseList(search.get("region")),
    priceMin: parsePrice(search.get("price_min")),
    priceMax: parsePrice(search.get("price_max")),
    sort: effectiveSort(q, isStoreSort(sort) ? sort : null),
    page: parsePageParam(search.get("page")) ?? 1,
  };
}

/**
 * The canonical search string, "" or "?q=...": defaults left out, params in a fixed order,
 * list values in the order ticked, joined by a plain comma.
 */
export function toStoreSearch(params: StoreParams): string {
  const parts: string[] = [];
  const add = (key: string, value: string) => parts.push(`${key}=${value}`);
  const list = (values: string[]) =>
    values.map((value) => encodeURIComponent(value)).join(",");

  if (params.q !== "") add("q", encodeURIComponent(params.q));
  if (params.platform.length > 0) add("platform", list(params.platform));
  if (params.region.length > 0) add("region", list(params.region));
  if (params.priceMin !== null) add("price_min", String(params.priceMin));
  if (params.priceMax !== null) add("price_max", String(params.priceMax));
  const sort = effectiveSort(params.q, params.sort);
  if (sort !== defaultSort(params.q)) add("sort", sort);
  if (params.page > 1) add("page", String(params.page));

  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function storeHref(params: StoreParams): string {
  return `${STORE_PATH}${toStoreSearch(params)}`;
}

export function canonicalStoreSearch(search: URLSearchParams): string {
  return toStoreSearch(parseStoreParams(search));
}

/** Compares decoded entries, so `%2C` against `,` or `+` against `%20` is not a difference. */
export function isSameSearch(a: URLSearchParams, b: URLSearchParams): boolean {
  const left = [...a.entries()];
  const right = [...b.entries()];
  return (
    left.length === right.length &&
    left.every(
      ([key, value], index) =>
        key === right[index][0] && value === right[index][1],
    )
  );
}

/** The Filters button badge: platform and region values, plus one for any price bound. */
export function activeFilterCount(params: StoreParams): number {
  const hasPrice = params.priceMin !== null || params.priceMax !== null;
  return params.platform.length + params.region.length + (hasPrice ? 1 : 0);
}

/** True when "Clear all" has something to clear (q is kept, so it does not count). */
export function hasClearableFilters(params: StoreParams): boolean {
  return (
    activeFilterCount(params) > 0 ||
    effectiveSort(params.q, params.sort) !== defaultSort(params.q)
  );
}

/** "€10 to €30", "From €10", "Up to €30", "€10", or null with no bound (AC-7). */
export function priceChipLabel(
  min: number | null,
  max: number | null,
): string | null {
  if (min !== null && max !== null) {
    return min === max ? `€${min}` : `€${min} to €${max}`;
  }
  if (min !== null) return `From €${min}`;
  if (max !== null) return `Up to €${max}`;
  return null;
}

/** The ErrorState message: 429 names the wait, other API errors pass their message (AC-9). */
export function storeErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.status === 429) {
    return `Too many requests. Try again in ${secondsText(error.retryAfter ?? 60)}.`;
  }
  return error.message;
}

export function resultCountLabel(total: number): string {
  return total === 1 ? "1 result" : `${total} results`;
}
