import { ApiError } from "../api/client";

const SITE_TITLE = "Eneba Marketplace (demo)";

export const ORDER_CONFIRMED_TITLE = `Order confirmed | ${SITE_TITLE}`;
export const ORDER_NOT_FOUND_TITLE = `Order not found | ${SITE_TITLE}`;

export function isOrderNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export const ORDER_DETAILS_TITLE = `Order details | ${SITE_TITLE}`;
export const ORDERS_TITLE = `My orders | ${SITE_TITLE}`;
