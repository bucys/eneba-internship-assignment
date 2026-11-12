import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import {
  addCartItem,
  fetchCart,
  mergeCart,
  previewCart,
  removeCartItem,
  updateCartItem,
  type Cart,
  type CartLineInput,
} from "../api/cart";
import { ApiError } from "../api/client";
import { useAuthToken } from "./auth";
import { authToken } from "./authToken";
import { GuestCartError, guestCart } from "./guestCart";
import { queryClient } from "./queryClient";

// Under "me", so clearAuth removes it with the rest of the user's data.
export const CART_KEY = ["me", "cart"] as const;

const MERGE_LOCK = "eneba.guestCart.merge";

export const EMPTY_CART: Cart = {
  lines: [],
  item_count: 0,
  total: { amount: 0, currency: "EUR" },
  can_checkout: false,
};

export const cartQueryOptions = queryOptions({
  queryKey: CART_KEY,
  queryFn: ({ signal }) => fetchCart(signal),
  // Another tab may have changed the cart (spec 0008, edge cases).
  refetchOnWindowFocus: true,
});

export function guestPreviewQuery(lines: CartLineInput[]) {
  return queryOptions({
    queryKey: ["cart", "preview", lines],
    queryFn: ({ signal }) => previewCart(lines, signal),
    // A stepper click keeps showing the last cart instead of the skeleton.
    placeholderData: keepPreviousData,
  });
}

export function useGuestCartLines(): CartLineInput[] {
  return useSyncExternalStore(guestCart.subscribe, guestCart.getSnapshot);
}

/** Runs a signed in cart write; a result that arrives after the token changed never reaches the cache. */
export async function runCartWrite(
  request: () => Promise<Cart>,
): Promise<Cart> {
  const token = authToken.get();
  const cart = await request();
  if (authToken.get() === token) {
    queryClient.setQueryData(CART_KEY, cart);
  }
  return cart;
}

async function mergeNow(): Promise<void> {
  const sent = guestCart.get();
  const token = authToken.get();
  if (sent.length === 0 || token === null) return;

  const cart = await mergeCart(sent);
  guestCart.removeSent(sent);
  if (authToken.get() === token) {
    // A GET /cart started before the merge must not overwrite the merged cart.
    await queryClient.cancelQueries({ queryKey: CART_KEY });
    queryClient.setQueryData(CART_KEY, cart);
  }
}

function withMergeLock(task: () => Promise<void>): Promise<void> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) return task();
  return locks.request(MERGE_LOCK, task);
}

let mergeInFlight: Promise<void> | null = null;

/**
 * The only place that merges the guest cart into the account (spec 0008 AC-11).
 * One call at a time per tab (shared promise) and across tabs (Web Lock).
 */
export function mergeGuestCart(): Promise<void> {
  mergeInFlight ??= withMergeLock(mergeNow).finally(() => {
    mergeInFlight = null;
  });
  return mergeInFlight;
}

export type CartView = {
  cart: Cart | undefined;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
};

/** The signed in cart when there is a token, else the guest cart through preview. */
export function useCart(): CartView {
  const token = useAuthToken();
  const guestLines = useGuestCartLines();
  const isGuest = token === null;
  const hasGuestLines = guestLines.length > 0;

  const server = useQuery({ ...cartQueryOptions, enabled: !isGuest });
  const preview = useQuery({
    ...guestPreviewQuery(guestLines),
    enabled: isGuest && hasGuestLines,
  });

  const settledPreview =
    isGuest && !preview.isPlaceholderData && !preview.isFetching
      ? preview.data
      : undefined;

  useEffect(() => {
    // AC-8 write back; reconcileWithPreview skips it when the stored lines changed since this request.
    if (settledPreview)
      guestCart.reconcileWithPreview(guestLines, settledPreview);
  }, [settledPreview, guestLines]);

  if (isGuest && !hasGuestLines) {
    return {
      cart: EMPTY_CART,
      isError: false,
      isFetching: false,
      refetch: () => {},
    };
  }

  const query = isGuest ? preview : server;
  return {
    cart: query.data,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
  };
}

/** The header badge count: stored quantities for a guest, item_count when signed in (0 while loading or failed). */
export function useCartCount(): number {
  const token = useAuthToken();
  const guestLines = useGuestCartLines();
  const server = useQuery({ ...cartQueryOptions, enabled: token !== null });

  if (token === null) {
    return guestLines.reduce((sum, line) => sum + line.quantity, 0);
  }
  return server.data?.item_count ?? 0;
}

/** Applies a cart change to the guest cart or the account, deciding from the token at the moment of the action. */
export async function runCartChange(
  guestChange: () => void,
  write: () => Promise<unknown>,
): Promise<void> {
  if (authToken.get() === null) {
    guestChange();
    return;
  }
  await write();
}

/**
 * Cart changes for one control. Each caller gets its own pending state, so only the
 * clicked button or line is disabled while its request runs.
 */
export function useCartActions() {
  const mutation = useMutation({
    mutationFn: (request: () => Promise<Cart>) => runCartWrite(request),
  });

  function run(guestChange: () => void, request: () => Promise<Cart>) {
    return runCartChange(guestChange, () => mutation.mutateAsync(request));
  }

  return {
    isPending: mutation.isPending,
    add: (offerId: number, stock: number) =>
      run(
        () => guestCart.add(offerId, stock),
        () => addCartItem(offerId),
      ),
    setQuantity: (offerId: number, quantity: number, cap: number) =>
      run(
        () => guestCart.setQuantity(offerId, quantity, cap),
        () => updateCartItem(offerId, quantity),
      ),
    remove: (offerId: number) =>
      run(
        () => guestCart.remove(offerId),
        () => removeCartItem(offerId),
      ),
  };
}

/** The message to show for a failed cart change: the rule's own message for a 422, else `fallback`. */
export function cartErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof GuestCartError) return error.message;
  if (error instanceof ApiError && error.status === 422) {
    const first = Object.values(error.errors ?? {})[0]?.[0];
    return first ?? error.message;
  }
  return fallback;
}
