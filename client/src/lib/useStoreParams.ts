import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  parseStoreParams,
  storeHref,
  toStoreSearch,
  type StoreParams,
} from "./storeParams";

export type StoreParamsUpdate = (current: StoreParams) => StoreParams;

/**
 * The store state from the URL, and `apply`, which pushes one history entry per real change
 * (spec 0012 AC-5). Any change other than a page link goes back to page 1.
 */
export function useStoreParams() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = parseStoreParams(new URLSearchParams(location.search));

  // The latest URL, including one just requested that this render has not seen yet.
  // Events can land between a navigation and the next render (Enter then an immediate Tab),
  // so `apply` must not compare against or build on the render's `params`.
  // Keyed on `location.key` too: a navigation that interrupts ours and lands on the same
  // search must still reset the ref, or it would keep the cancelled target.
  const latestSearch = useRef(location.search);
  useLayoutEffect(() => {
    latestSearch.current = location.search;
  }, [location.key, location.search]);

  function apply(update: StoreParamsUpdate) {
    const current = parseStoreParams(new URLSearchParams(latestSearch.current));
    const target = { ...update(current), page: 1 };
    // Page is ignored on both sides, so a no op on page 2+ keeps the visitor's page.
    if (toStoreSearch(target) === toStoreSearch({ ...current, page: 1 })) {
      return;
    }
    latestSearch.current = toStoreSearch(target);
    void navigate(storeHref(target), { preventScrollReset: true });
  }

  return { params, apply };
}
