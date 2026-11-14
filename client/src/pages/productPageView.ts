import type { Money } from "../lib/money";
import { ApiError } from "../api/client";

const SITE_TITLE = "Eneba Marketplace (demo)";

export type ProductPageView = "ready" | "loading" | "not-found" | "error";

type ProductQueryState = {
  hasData: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
};

function isNotFound(error: unknown) {
  return (
    error instanceof ApiError && error.kind === "http" && error.status === 404
  );
}

/**
 * A confirmed 404 means the game is gone, so it wins even over cached data.
 * Transient failures (5xx, network, timeout) keep the page the buyer is reading.
 */
export function getProductPageView({
  hasData,
  isError,
  isFetching,
  error,
}: ProductQueryState): ProductPageView {
  const settledError = isError && !isFetching;
  if (settledError && isNotFound(error)) {
    return "not-found";
  }
  if (hasData) {
    return "ready";
  }
  if (settledError) {
    return "error";
  }
  return "loading";
}

export function productPageTitle(view: ProductPageView, productName?: string) {
  const titles: Record<ProductPageView, string> = {
    ready: productName ?? "Game",
    loading: "Loading game",
    "not-found": "Game not found",
    error: "Could not load game",
  };
  return `${titles[view]} | ${SITE_TITLE}`;
}

type OfferLike = { id: number; price: Money; stock: number };

/**
 * The buy box "+N offers from €X" link (spec 0015 AC-16): in stock offers other than the
 * best one, and the lowest of their prices. Null when there are none.
 */
export function otherOffersSummary(
  offers: OfferLike[],
  bestOfferId: number | null,
): { count: number; lowest: Money } | null {
  const others = offers.filter(
    (offer) => offer.id !== bestOfferId && offer.stock > 0,
  );
  if (others.length === 0) return null;
  const lowest = others.reduce((min, offer) =>
    offer.price.amount < min.price.amount ? offer : min,
  ).price;
  return { count: others.length, lowest };
}
