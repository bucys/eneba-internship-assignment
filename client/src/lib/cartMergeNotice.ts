import { authToken } from "./authToken";
import { mergeGuestCart } from "./cart";

type Listener = () => void;

let pending = false;
const listeners = new Set<Listener>();

/**
 * Holds "the last merge changed the cart" until the layout shows its toast (spec 0016 AC-12).
 * The merge can finish before any component mounts (on start), so it waits as a flag.
 */
export const cartMergeNotice = {
  raise() {
    pending = true;
    listeners.forEach((listener) => listener());
  },
  /** True once per raise; clears the flag. */
  take(): boolean {
    const wasPending = pending;
    pending = false;
    return wasPending;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * Merges the guest cart and raises the notice when the server capped or dropped a line,
 * unless the user signed out or switched accounts while the merge ran.
 */
export async function mergeGuestCartAndNotify(): Promise<void> {
  const token = authToken.get();
  const adjustments = await mergeGuestCart();
  if (adjustments.length > 0 && authToken.get() === token) {
    cartMergeNotice.raise();
  }
}
