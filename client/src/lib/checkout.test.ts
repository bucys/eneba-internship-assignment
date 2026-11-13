import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const { ApiError } = await import("../api/client");
const {
  PAYMENT_FAILED,
  PAYMENT_UNREACHABLE,
  checkoutErrorMessage,
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
