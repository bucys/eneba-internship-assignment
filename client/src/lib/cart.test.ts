import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart, CartLineInput } from "../api/cart";

vi.mock("./env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const mergeCart = vi.fn<(items: CartLineInput[]) => Promise<Cart>>();
const previewCart = vi.fn<(items: CartLineInput[]) => Promise<Cart>>();
vi.mock("../api/cart", () => ({
  mergeCart: (items: CartLineInput[]) => mergeCart(items),
  previewCart: (items: CartLineInput[]) => previewCart(items),
}));

const { ApiError } = await import("../api/client");
const { authToken } = await import("./authToken");
const { GuestCartError, guestCart } = await import("./guestCart");
const { queryClient } = await import("./queryClient");
const {
  CART_KEY,
  EMPTY_CART,
  cartErrorMessage,
  guestPreviewQuery,
  mergeGuestCart,
  runCartChange,
  runCartWrite,
} = await import("./cart");

const MERGED: Cart = { ...EMPTY_CART, item_count: 3 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.stubGlobal("navigator", {});
  mergeCart.mockReset();
  previewCart.mockReset();
  queryClient.clear();
  guestCart.clear();
  authToken.set("token-a");
});

afterEach(() => {
  vi.unstubAllGlobals();
  authToken.clear();
});

describe("mergeGuestCart", () => {
  it("does nothing when there are no guest lines", async () => {
    await mergeGuestCart();

    expect(mergeCart).not.toHaveBeenCalled();
  });

  it("sends one request when called twice at once and stores the merged cart", async () => {
    guestCart.replace([{ offer_id: 1, quantity: 2 }]);
    mergeCart.mockResolvedValue(MERGED);

    await Promise.all([mergeGuestCart(), mergeGuestCart()]);

    expect(mergeCart).toHaveBeenCalledOnce();
    expect(mergeCart).toHaveBeenCalledWith([{ offer_id: 1, quantity: 2 }]);
    expect(queryClient.getQueryData(CART_KEY)).toEqual(MERGED);
    expect(guestCart.get()).toEqual([]);
  });

  it("keeps lines added or changed while the request ran", async () => {
    guestCart.replace([
      { offer_id: 1, quantity: 2 },
      { offer_id: 2, quantity: 1 },
    ]);
    const response = deferred<Cart>();
    mergeCart.mockReturnValue(response.promise);

    const merging = mergeGuestCart();
    guestCart.setQuantity(2, 3, 10);
    guestCart.add(3, 5);
    response.resolve(MERGED);
    await merging;

    expect(guestCart.get()).toEqual([
      { offer_id: 2, quantity: 3 },
      { offer_id: 3, quantity: 1 },
    ]);
  });

  it("keeps every line when the merge fails", async () => {
    guestCart.replace([{ offer_id: 1, quantity: 2 }]);
    mergeCart.mockRejectedValue(new Error("offline"));

    await expect(mergeGuestCart()).rejects.toThrow("offline");

    expect(guestCart.get()).toEqual([{ offer_id: 1, quantity: 2 }]);
    expect(queryClient.getQueryData(CART_KEY)).toBeUndefined();
  });

  it("runs inside the cross tab lock when Web Locks exist", async () => {
    const request = vi.fn((_name: string, task: () => Promise<void>) => task());
    vi.stubGlobal("navigator", { locks: { request } });
    guestCart.replace([{ offer_id: 1, quantity: 1 }]);
    mergeCart.mockResolvedValue(MERGED);

    await mergeGuestCart();

    expect(request).toHaveBeenCalledWith(
      "eneba.guestCart.merge",
      expect.any(Function),
    );
    expect(mergeCart).toHaveBeenCalledOnce();
  });
});

describe("runCartWrite", () => {
  it("stores the result when the token is unchanged", async () => {
    await runCartWrite(async () => MERGED);

    expect(queryClient.getQueryData(CART_KEY)).toEqual(MERGED);
  });

  it("leaves the cache alone when the token changed during the request", async () => {
    const response = deferred<Cart>();
    const writing = runCartWrite(() => response.promise);

    authToken.clear();
    response.resolve(MERGED);
    await writing;

    expect(queryClient.getQueryData(CART_KEY)).toBeUndefined();
  });
});

describe("guestPreviewQuery", () => {
  it("returns the preview without changing the guest cart", async () => {
    const lines = [
      { offer_id: 1, quantity: 5 },
      { offer_id: 2, quantity: 1 },
    ];
    guestCart.replace(lines);
    // Offer 2 is gone and offer 1 was reduced, which reconcile would write back.
    const preview: Cart = {
      ...EMPTY_CART,
      lines: [
        {
          offer_id: 1,
          quantity: 3,
          quantity_reduced: true,
          available: true,
        } as Cart["lines"][number],
      ],
    };
    previewCart.mockResolvedValue(preview);

    const result = await queryClient.fetchQuery(guestPreviewQuery(lines));

    expect(result).toEqual(preview);
    expect(guestCart.get()).toEqual(lines);
  });
});

describe("runCartChange", () => {
  it("changes the guest cart when signed out at the moment of the action", async () => {
    authToken.clear();
    const guestChange = vi.fn();
    const write = vi.fn();

    await runCartChange(guestChange, write);

    expect(guestChange).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
  });

  it("writes to the account when signed in at the moment of the action", async () => {
    const guestChange = vi.fn();
    const write = vi.fn(async () => MERGED);

    await runCartChange(guestChange, write);

    expect(write).toHaveBeenCalledOnce();
    expect(guestChange).not.toHaveBeenCalled();
  });

  it("reads the token when called, not when the action was created", async () => {
    authToken.clear();
    const guestChange = vi.fn();
    const write = vi.fn(async () => MERGED);
    const add = () => runCartChange(guestChange, write);

    authToken.set("token-b");
    await add();

    expect(write).toHaveBeenCalledOnce();
    expect(guestChange).not.toHaveBeenCalled();
  });

  it("passes a failed account write to the caller", async () => {
    const error = new Error("offline");

    await expect(
      runCartChange(vi.fn(), () => Promise.reject(error)),
    ).rejects.toBe(error);
  });
});

describe("cartErrorMessage", () => {
  const FALLBACK = "Could not update your cart. Please try again.";

  it("uses a guest rule's own message", () => {
    const error = new GuestCartError("quantity", "Your cart is full.");

    expect(cartErrorMessage(error, FALLBACK)).toBe("Your cart is full.");
  });

  it("uses the first field message of a 422", () => {
    const error = new ApiError({
      kind: "http",
      status: 422,
      message: "The given data was invalid.",
      errors: { offer_id: ["This offer is out of stock."] },
    });

    expect(cartErrorMessage(error, FALLBACK)).toBe(
      "This offer is out of stock.",
    );
  });

  it("uses the 422 message when it has no field errors", () => {
    const error = new ApiError({
      kind: "http",
      status: 422,
      message: "The given data was invalid.",
    });

    expect(cartErrorMessage(error, FALLBACK)).toBe(
      "The given data was invalid.",
    );
  });

  it("uses the fallback for any other failure", () => {
    const serverError = new ApiError({
      kind: "http",
      status: 500,
      message: "Server Error",
    });

    expect(cartErrorMessage(serverError, FALLBACK)).toBe(FALLBACK);
    expect(cartErrorMessage(new Error("offline"), FALLBACK)).toBe(FALLBACK);
  });
});
