import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const { ApiError } = await import("../api/client");
const { ORDER_LIST_KEY, orderListQueryKey, orderQueryKey } =
  await import("../api/orders");
const {
  itemCountLabel,
  moreProductsLabel,
  orderListErrorMessage,
  ordersPageHref,
  parsePageParam,
  readFromPage,
  shortOrderNumber,
} = await import("./orderHistory");

// covers: spec 0011 AC-4
describe("parsePageParam", () => {
  it.each([
    [null, null],
    ["1", 1],
    ["3", 3],
    ["0", null],
    ["-1", null],
    ["2.5", null],
    ["abc", null],
    [" 2", null],
    ["01", null],
    ["99999999999999999999", null],
  ])("reads %j as %j", (raw, expected) => {
    expect(parsePageParam(raw)).toBe(expected);
  });
});

describe("ordersPageHref", () => {
  it("gives page 1 a single URL", () => {
    expect(ordersPageHref(1)).toBe("/orders");
    expect(ordersPageHref(3)).toBe("/orders?page=3");
  });
});

// covers: spec 0011 AC-3
describe("row labels", () => {
  it("shortens the order number to the last 8 characters in uppercase", () => {
    expect(shortOrderNumber("01jcheckoutorder00000abcdz")).toBe("#000ABCDZ");
  });

  it("counts items and extra products", () => {
    expect(itemCountLabel(1)).toBe("1 item");
    expect(itemCountLabel(3)).toBe("3 items");
    expect(moreProductsLabel(1)).toBe("");
    expect(moreProductsLabel(2)).toBe("and 1 more product");
    expect(moreProductsLabel(4)).toBe("and 3 more products");
  });
});

// covers: spec 0011 AC-7
describe("readFromPage", () => {
  it.each([
    [undefined, 1],
    [null, 1],
    [{}, 1],
    [{ fromPage: "3" }, 1],
    [{ fromPage: 1 }, 1],
    [{ fromPage: 2.5 }, 1],
    [{ fromPage: 3 }, 3],
  ])("reads %j as page %j", (state, expected) => {
    expect(readFromPage(state)).toBe(expected);
  });
});

// covers: spec 0011 AC-5
describe("orderListErrorMessage", () => {
  it("names the wait on a 429 and passes other API messages", () => {
    const tooMany = new ApiError({
      kind: "http",
      status: 429,
      message: "Too Many Attempts.",
      retryAfter: 42,
    });
    const server = new ApiError({ kind: "http", status: 500, message: "Boom" });

    expect(orderListErrorMessage(tooMany)).toBe(
      "Too many requests. Try again in 42 seconds.",
    );
    expect(orderListErrorMessage(server)).toBe("Boom");
    expect(orderListErrorMessage(new Error("x"))).toBeUndefined();
  });
});

// covers: spec 0011 AC-6
describe("order list query key", () => {
  it("lives under me but not under the single order key", () => {
    const key = orderListQueryKey(2);
    expect(key[0]).toBe("me");
    expect(key.slice(0, 2)).toEqual([...ORDER_LIST_KEY]);
    expect(key[1]).not.toBe(orderQueryKey("x")[1]);
  });
});
