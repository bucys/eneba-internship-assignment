import { ApiError } from "../api/client";
import type { OrderSummary } from "../api/orders";
import { secondsText } from "./format";

export const ORDER_STATUS_LABEL: Record<OrderSummary["status"], string> = {
  paid: "Paid",
};

/** A whole number of 1 or more from `?page`, else null (spec 0011 AC-4). */
export function parsePageParam(raw: string | null): number | null {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : null;
}

/** Page 1 has exactly one URL, `/orders`. */
export function ordersPageHref(page: number): string {
  return page > 1 ? `/orders?page=${page}` : "/orders";
}

export function shortOrderNumber(ulid: string): string {
  return `#${ulid.slice(-8).toUpperCase()}`;
}

export function itemCountLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

/** "and N more products" after the first product's name; empty for a single line order. */
export function moreProductsLabel(lineCount: number): string {
  const more = lineCount - 1;
  if (more < 1) return "";
  return more === 1 ? "and 1 more product" : `and ${more} more products`;
}

/** The list page the buyer came from, carried in router state (spec 0011 AC-7). */
export function readFromPage(state: unknown): number {
  const fromPage =
    typeof state === "object" && state !== null && "fromPage" in state
      ? state.fromPage
      : undefined;
  return typeof fromPage === "number" &&
    Number.isSafeInteger(fromPage) &&
    fromPage > 1
    ? fromPage
    : 1;
}

/** The ErrorState message: 429 names the wait, other API errors pass their message (AC-5). */
export function orderListErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.status === 429) {
    return `Too many requests. Try again in ${secondsText(error.retryAfter ?? 60)}.`;
  }
  return error.message;
}
