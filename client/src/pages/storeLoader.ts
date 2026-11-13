import { replace, type LoaderFunctionArgs } from "react-router";
import {
  canonicalStoreSearch,
  isSameSearch,
  STORE_PATH,
} from "../lib/storeParams";

/**
 * Replaces a non canonical store URL (defaults, invalid values, unknown params, odd order)
 * with the canonical one. `replace`, not `redirect`: a loader redirect would push a new
 * history entry, and back would land on the old URL again (spec 0012 AC-5).
 */
export function storeLoader({ request }: LoaderFunctionArgs) {
  const search = new URL(request.url).searchParams;
  const canonical = canonicalStoreSearch(search);
  if (!isSameSearch(search, new URLSearchParams(canonical))) {
    return replace(`${STORE_PATH}${canonical}`);
  }
  return null;
}
