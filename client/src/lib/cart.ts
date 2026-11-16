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
  type CartAdjustment,
  type CartLineInput,
  type CartWriteResult,
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

function cartOf(result: Cart | CartWriteResult): Cart {
  return "cart" in result ? result.cart : result;
}

/** Runs a signed in cart write; a result that arrives after the token changed never reaches the cache. */
export async function runCartWrite<T extends Cart | CartWriteResult>(
  request: () => Promise<T>,
): Promise<T> {
  const token = authToken.get();
  const result = await request();
  if (authToken.get() === token) {
    queryClient.setQueryData(CART_KEY, cartOf(result));
  }
  return result;
}

async function mergeNow(): Promise<CartAdjustment[]> {
  const sent = guestCart.get();
  const token = authToken.get();
  if (sent.length === 0 || token === null) return [];

  const { cart, adjustments } = await mergeCart(sent);
  guestCart.removeSent(sent);
  if (authToken.get() === token) {
    // A GET /cart started before the merge must not overwrite the merged cart.
    await queryClient.cancelQueries({ queryKey: CART_KEY });
    queryClient.setQueryData(CART_KEY, cart);
  }
  return adjustments;
}

function withMergeLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) return task();
  return locks.request(MERGE_LOCK, task);
}

let mergeInFlight: Promise<CartAdjustment[]> | null = null;

/**
 * The only place that merges the guest cart into the account (spec 0008 AC-11).
 * One call at a time per tab (shared promise) and across tabs (Web Lock).
 * Resolves to the lines the server capped or dropped (spec 0016 AC-11), `[]` when nothing was sent.
 */
export function mergeGuestCart(): Promise<CartAdjustment[]> {
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

/**
 * Applies a cart change to the guest cart or the account, deciding from the token at the moment
 * of the action. Resolves to the write's result, or undefined for a guest change.
 */
export async function runCartChange<T>(
  guestChange: () => void,
  write: () => Promise<T>,
): Promise<T | undefined> {
  if (authToken.get() === null) {
    guestChange();
    return undefined;
  }
  return write();
}

/**
 * Cart changes for one control. Each caller gets its own pending state, so only the
 * clicked button or line is disabled while its request runs.
 */
export function useCartActions() {
  const mutation = useMutation({
    mutationFn: (request: () => Promise<Cart | CartWriteResult>) =>
      runCartWrite(request),
  });

  function run(
    guestChange: () => void,
    request: () => Promise<Cart | CartWriteResult>,
  ) {
    return runCartChange(guestChange, () => mutation.mutateAsync(request));
  }

  return {
    isPending: mutation.isPending,
    /** Resolves to the server's adjustments; a guest add caps locally and resolves to `[]`. */
    add: async (offerId: number, stock: number): Promise<CartAdjustment[]> => {
      const result = await run(
        () => guestCart.add(offerId, stock),
        () => addCartItem(offerId),
      );
      return result !== undefined && "adjustments" in result
        ? result.adjustments
        : [];
    },
    setQuantity: (offerId: number, quantity: number, cap: number) =>
      run(
        () => guestCart.setQuantity(offerId, quantity, cap),
        () => updateCartItem(offerId, quantity),
      ).then(() => undefined),
    remove: (offerId: number) =>
      run(
        () => guestCart.remove(offerId),
        () => removeCartItem(offerId),
      ).then(() => undefined),
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
