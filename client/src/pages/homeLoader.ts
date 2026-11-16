import {
  HOME_BLOCK_QUERIES,
  homeLayoutQuery,
  type HomeBlockType,
} from "../api/home";
import { queryClient } from "../lib/queryClient";

// One entry per block type (typecheck enforces it). Written out per key because the
// factories return different data types, which a single loop cannot pass to prefetchQuery.
const PREFETCH_BLOCK: Record<HomeBlockType, () => Promise<void>> = {
  banners: () => queryClient.prefetchQuery(HOME_BLOCK_QUERIES.banners()),
  best_sellers: () =>
    queryClient.prefetchQuery(HOME_BLOCK_QUERIES.best_sellers()),
  deals: () => queryClient.prefetchQuery(HOME_BLOCK_QUERIES.deals()),
  products: () => queryClient.prefetchQuery(HOME_BLOCK_QUERIES.products()),
};

/**
 * Starts the layout and every block query at once instead of waiting for the layout
 * (spec 0016 AC-6). Not awaited, so the skeleton renders as before. A fresh cache entry
 * is not fetched again, and each block's useQuery joins the request already in flight.
 */
export function homeLoader() {
  void queryClient.prefetchQuery(homeLayoutQuery());
  for (const prefetch of Object.values(PREFETCH_BLOCK)) {
    void prefetch();
  }
  return null;
}
