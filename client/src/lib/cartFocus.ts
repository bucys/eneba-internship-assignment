export type RemovedLine = { offerId: number; index: number };

/**
 * Where focus goes after a Remove: the Remove button now at the removed row's index
 * (or the new last row), the page heading once the cart is empty, or null while the
 * removed line is still on screen.
 */
export function focusAfterRemove(
  offerIds: number[],
  removed: RemovedLine,
): number | "heading" | null {
  if (offerIds.includes(removed.offerId)) return null;
  if (offerIds.length === 0) return "heading";
  return Math.min(removed.index, offerIds.length - 1);
}
