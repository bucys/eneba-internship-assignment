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
