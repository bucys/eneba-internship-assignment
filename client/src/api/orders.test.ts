import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, order } from "../test/fixtures";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const {
  getOrder,
  getOrderKeys,
  orderKeysQuery,
  orderKeysQueryKey,
  orderQuery,
  orderQueryKey,
  placeOrder,
} = await import("./orders");

const input = {
  card_number: "4242 4242 4242 4242",
  card_expiry: "12/29",
  card_cvc: "123",
  card_name: "Jane Buyer",
  expected_total: 3998,
};

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastRequest(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.lastCall as unknown as [
    string,
    RequestInit,
  ];
  return { url, init, headers: new Headers(init.headers) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("placeOrder", () => {
  it("posts the card and expected total to /checkout with the idempotency key", async () => {
    const fetchMock = stubFetch(jsonResponse(201, { data: order() }));

    const result = await placeOrder(
      input,
      "4f8a2c1e-0000-4000-8000-000000000001",
    );

    const { url, init, headers } = lastRequest(fetchMock);
    expect(url).toBe("https://api.example.test/api/v1/checkout");
    expect(init.method).toBe("POST");
    expect(headers.get("Idempotency-Key")).toBe(
      "4f8a2c1e-0000-4000-8000-000000000001",
    );
    expect(JSON.parse(init.body as string)).toEqual(input);
    expect(result).toEqual(order());
  });

  it("returns a replayed order from a 200 the same way", async () => {
    stubFetch(jsonResponse(200, { data: order({ ulid: "01jreplay" }) }));

    await expect(placeOrder(input, "key")).resolves.toMatchObject({
      ulid: "01jreplay",
    });
  });

  it("rejects with the decline message on a 422 payment error", async () => {
    stubFetch(
      jsonResponse(422, {
        message: "Your card was declined.",
        errors: { payment: ["Your card was declined."] },
      }),
    );

    await expect(placeOrder(input, "key")).rejects.toMatchObject({
      status: 422,
      errors: { payment: ["Your card was declined."] },
    });
  });

  // Value sourcing: "a 429 shows Try again in N seconds" reads N from Retry-After.
  it("carries Retry-After on a 429", async () => {
    stubFetch(
      jsonResponse(
        429,
        { message: "Too Many Attempts." },
        { "Retry-After": "17" },
      ),
    );

    await expect(placeOrder(input, "key")).rejects.toMatchObject({
      status: 429,
      retryAfter: 17,
    });
  });
});

describe("getOrder", () => {
  it("gets the order by its ULID and unwraps data", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { data: order() }));

    await expect(getOrder("01jcheckoutorder0000000000")).resolves.toEqual(
      order(),
    );
    expect(lastRequest(fetchMock).url).toBe(
      "https://api.example.test/api/v1/orders/01jcheckoutorder0000000000",
    );
  });

  it("encodes a ULID from the URL so it cannot change the path", async () => {
    const fetchMock = stubFetch(jsonResponse(404, { message: "Not found." }));

    await getOrder("../cart").catch(() => undefined);

    expect(lastRequest(fetchMock).url).toBe(
      "https://api.example.test/api/v1/orders/..%2Fcart",
    );
  });
});

describe("orderQuery", () => {
  it("keys the order under me, so sign out clears it", () => {
    expect(orderQueryKey("01jabc")).toEqual(["me", "orders", "01jabc"]);
    expect(orderQuery("01jabc").queryKey).toEqual(["me", "orders", "01jabc"]);
  });
});

describe("getOrderKeys", () => {
  it("gets the keys by the order ULID, encoded, and unwraps data", async () => {
    const keys = [{ order_item_id: 7, codes: ["AAAAA-BBBBB-CCCCC"] }];
    const fetchMock = stubFetch(jsonResponse(200, { data: keys }));

    await expect(getOrderKeys("../cart")).resolves.toEqual(keys);
    expect(lastRequest(fetchMock).url).toBe(
      "https://api.example.test/api/v1/orders/..%2Fcart/keys",
    );
  });
});

describe("orderKeysQuery", () => {
  // covers: spec 0010 AC-10
  it("keys the codes under me as a sibling of the order and drops them on unmount", () => {
    expect(orderKeysQueryKey("01jabc")).toEqual(["me", "order-keys", "01jabc"]);
    const options = orderKeysQuery("01jabc");
    expect(options.queryKey).toEqual(["me", "order-keys", "01jabc"]);
    expect(options.gcTime).toBe(0);
    expect(options.staleTime).toBe(Infinity);
  });
});
