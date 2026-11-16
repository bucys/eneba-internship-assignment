import { useEffect, useRef } from "react";
import { authToken } from "../../lib/authToken";
import { cartMergeNotice } from "../../lib/cartMergeNotice";
import { useToast } from "../ui/toastContext";

export const CART_MERGE_MESSAGE =
  "Some items in your cart were changed to match available stock.";

/**
 * Shows one toast after a sign in merge that capped or dropped lines (spec 0016 AC-12).
 * A sign out or another sign in removes it, since it described the previous session's cart.
 */
export function CartMergeToast() {
  const toast = useToast();
  // A ref, not a local, so the StrictMode rerun of the effect can still dismiss it.
  const shownId = useRef<number | null>(null);

  useEffect(() => {
    function showIfPending() {
      if (!cartMergeNotice.take()) return;
      shownId.current = toast.show({
        message: CART_MERGE_MESSAGE,
        variant: "info",
        action: { label: "View cart", to: "/cart" },
      });
    }

    function dropOnAuthChange() {
      cartMergeNotice.take();
      if (shownId.current === null) return;
      toast.dismiss(shownId.current);
      shownId.current = null;
    }

    showIfPending();
    const stopNotice = cartMergeNotice.subscribe(showIfPending);
    const stopAuth = authToken.subscribe(dropOnAuthChange);
    return () => {
      stopNotice();
      stopAuth();
    };
  }, [toast]);

  return null;
}
