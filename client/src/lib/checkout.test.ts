import { MutationObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckoutInput, Order } from "../api/orders";

vi.mock("./env", () => ({ env: { apiUrl: "https://api.example.test" } }));
vi.mock("../api/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/orders")>()),
  placeOrder: vi.fn(),
}));

const { ApiError } = await import("../api/client");
const { orderListQueryKey, placeOrder } = await import("../api/orders");
const { authToken } = await import("./authToken");
const { CART_KEY } = await import("./cart");
const { queryClient } = await import("./queryClient");
const {
  ACCOUNT_CHANGED_NOTICE,
  PAYMENT_FAILED,
  PAYMENT_UNREACHABLE,
  accountChangedNotice,
  checkoutErrorMessage,
  isOpeningOrder,
  placeOrderOptions,
  shouldRefetchCart,
} = await import("./checkout");

function http(
  status: number,
  errors?: Record<string, string[]>,
  extra: { message?: string; retryAfter?: number } = {},
) {
  return new ApiError({
    kind: "http",
    status,
    message: extra.message ?? "Server message.",
    errors,
    retryAfter: extra.retryAfter,
  });
}

describe("checkoutErrorMessage", () => {
  it("shows the server message for a 409", () => {
    expect(
      checkoutErrorMessage(
        http(409, undefined, {
          message: "Your cart changed. Check the updated total and try again.",
        }),
      ),
    ).toEqual({
      formError: "Your cart changed. Check the updated total and try again.",
    });
  });

  it("puts card field errors under their fields", () => {
    expect(
      checkoutErrorMessage(
        http(422, {
          card_number: ["Enter a valid card number."],
          card_expiry: ["This card has expired."],
        }),
      ),
    ).toEqual({
      fieldErrors: {
        card_number: "Enter a valid card number.",
        card_expiry: "This card has expired.",
      },
      formError: undefined,
    });
  });

  it("shows a decline in the form alert, never under a field", () => {
    expect(
      checkoutErrorMessage(http(422, { payment: ["Your card was declined."] })),
    ).toEqual({ formError: "Your card was declined." });
  });

  it("says nothing on the form for an empty cart", () => {
    expect(
      checkoutErrorMessage(http(422, { cart: ["Your cart is empty."] })),
    ).toEqual({});
  });

  it.each(["idempotency_key", "expected_total", "something_new"])(
    "shows the generic message for a 422 on %s",
    (key) => {
      expect(checkoutErrorMessage(http(422, { [key]: ["x"] }))).toEqual({
        formError: PAYMENT_FAILED,
        fieldErrors: undefined,
      });
    },
  );

  it("keeps card field errors and adds the generic message when another key fails too", () => {
    expect(
      checkoutErrorMessage(
        http(422, {
          card_cvc: ["Bad CVC."],
          expected_total: ["Invalid total."],
        }),
      ),
    ).toEqual({
      fieldErrors: { card_cvc: "Bad CVC." },
      formError: PAYMENT_FAILED,
    });
  });

  it("shows the wait in seconds for a 429", () => {
    expect(
      checkoutErrorMessage(http(429, undefined, { retryAfter: 42 })),
    ).toEqual({
      formError: "Too many payment attempts. Try again in 42 seconds.",
    });
    expect(
      checkoutErrorMessage(http(429, undefined, { retryAfter: 1 })),
    ).toEqual({
      formError: "Too many payment attempts. Try again in 1 second.",
    });
  });

  it.each(["network", "timeout"] as const)(
    "shows the unreachable message for a %s error",
    (kind) => {
      expect(
        checkoutErrorMessage(new ApiError({ kind, status: 0, message: "x" })),
      ).toEqual({ formError: PAYMENT_UNREACHABLE });
    },
  );

  it("shows the generic message for anything else", () => {
    expect(checkoutErrorMessage(http(500))).toEqual({
      formError: PAYMENT_FAILED,
    });
    expect(checkoutErrorMessage(new Error("boom"))).toEqual({
      formError: PAYMENT_FAILED,
    });
  });
});

describe("shouldRefetchCart", () => {
  it("refetches after a 409 or a 422 on cart only", () => {
    expect(shouldRefetchCart(http(409))).toBe(true);
    expect(shouldRefetchCart(http(422, { cart: ["x"] }))).toBe(true);
    expect(shouldRefetchCart(http(422, { payment: ["x"] }))).toBe(false);
    expect(shouldRefetchCart(http(500))).toBe(false);
  });
});

describe("placeOrderOptions", () => {
  const order = { ulid: "01jorder" } as Order;
  const input = { expected_total: 1999 } as CheckoutInput;

  afterEach(() => {
    vi.mocked(placeOrder).mockReset();
    queryClient.clear();
    authToken.clear();
  });

  function setup() {
    const navigate = vi.fn();
    const observer = new MutationObserver(
      queryClient,
      placeOrderOptions("key-1", navigate),
    );
    return { navigate, observer };
  }

  it("opens the order when the same token is still signed in", async () => {
    authToken.set("token-a");
    vi.mocked(placeOrder).mockResolvedValue(order);
    queryClient.setQueryData(orderListQueryKey(2), { data: [] });
    const { navigate, observer } = setup();

    await observer.mutate(input);

    // covers: spec 0011 AC-6, AC-7
    expect(queryClient.getQueryState(orderListQueryKey(2))?.isInvalidated).toBe(
      true,
    );
    expect(navigate).toHaveBeenCalledWith("/orders/01jorder", {
      replace: true,
      state: { justPaid: true },
    });
    expect(isOpeningOrder(observer.getCurrentResult(), "token-a")).toBe(true);
    expect(
      accountChangedNotice(observer.getCurrentResult(), "token-a"),
    ).toBeUndefined();
  });

  // Regression: the form stayed on "Processing payment" forever (review 2026-11-13).
  it("unlocks the form and writes no caches when the token changed mid request", async () => {
    authToken.set("token-a");
    vi.mocked(placeOrder).mockImplementation(async () => {
      authToken.set("token-b");
      return order;
    });
    const { navigate, observer } = setup();

    await observer.mutate(input);

    expect(navigate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(CART_KEY)).toBeUndefined();
    expect(isOpeningOrder(observer.getCurrentResult(), "token-b")).toBe(false);
    expect(accountChangedNotice(observer.getCurrentResult(), "token-b")).toBe(
      ACCOUNT_CHANGED_NOTICE,
    );
  });

  it("sends the same idempotency key on a retry after unlocking", async () => {
    authToken.set("token-a");
    vi.mocked(placeOrder).mockImplementationOnce(async () => {
      authToken.set("token-b");
      return order;
    });
    vi.mocked(placeOrder).mockResolvedValueOnce(order);
    const { navigate, observer } = setup();

    await observer.mutate(input);
    await observer.mutate(input);

    expect(vi.mocked(placeOrder).mock.calls.map((call) => call[1])).toEqual([
      "key-1",
      "key-1",
    ]);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(
      accountChangedNotice(observer.getCurrentResult(), "token-b"),
    ).toBeUndefined();
  });

  it("shows no notice while a payment is pending or after it failed", async () => {
    authToken.set("token-a");
    vi.mocked(placeOrder).mockRejectedValue(new Error("boom"));
    const { observer } = setup();

    expect(
      accountChangedNotice(observer.getCurrentResult(), "token-b"),
    ).toBeUndefined();
    await observer.mutate(input).catch(() => undefined);
    expect(
      accountChangedNotice(observer.getCurrentResult(), "token-b"),
    ).toBeUndefined();
  });
});
