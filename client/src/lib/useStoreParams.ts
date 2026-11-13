import { useLocation, useNavigate } from "react-router";
import {
  parseStoreParams,
  storeHref,
  toStoreSearch,
  type StoreParams,
} from "./storeParams";

/**
 * The store state from the URL, and `apply`, which pushes one history entry per real change
 * (spec 0012 AC-5). Any change other than a page link goes back to page 1.
 */
export function useStoreParams() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = parseStoreParams(new URLSearchParams(location.search));

  function apply(next: StoreParams) {
    const target = { ...next, page: 1 };
    // Page is ignored on both sides, so a no op on page 2+ keeps the visitor's page.
    if (toStoreSearch(target) === toStoreSearch({ ...params, page: 1 })) return;
    void navigate(storeHref(target), { preventScrollReset: true });
  }

  return { params, apply };
}
