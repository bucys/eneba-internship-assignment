// @vitest-environment jsdom
import "../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "../api/cart";
import { cart, cartLine, jsonResponse, order } from "../test/fixtures";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const { authToken } = await import("../lib/authToken");
const { CART_KEY, EMPTY_CART } = await import("../lib/cart");
const { queryClient } = await import("../lib/queryClient");
const { orderQueryKey } = await import("../api/orders");
const { CheckoutPage } = await import("./CheckoutPage");

type Handler = (init: RequestInit) => Response;

/** Answers each `METHOD /path` from a queue; the last answer repeats. */
function stubApi(routes: Record<string, Handler[]>) {
  const calls: { route: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace("https://api.example.test/api/v1", "");
    const route = `${init.method ?? "GET"} ${path}`;
    calls.push({ route, init });
    const queue = routes[route];
    if (!queue) throw new Error(`Unexpected request: ${route}`);
    const handler = queue.length > 1 ? queue.shift()! : queue[0];
    return handler(init);
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    count: (route: string) =>
      calls.filter((call) => call.route === route).length,
    checkouts: () =>
      calls
        .filter((call) => call.route === "POST /checkout")
        .map((call) => ({
          key: new Headers(call.init.headers).get("Idempotency-Key"),
          body: JSON.parse(call.init.body as string) as Record<string, unknown>,
        })),
  };
}

const cartAnswer = (value: Cart) => () => jsonResponse(200, { data: value });

const declined = () =>
  jsonResponse(422, {
    message: "Your card was declined.",
    errors: { payment: ["Your card was declined."] },
  });

function renderCheckout() {
  const router = createMemoryRouter(
    [
      { path: "/checkout", Component: CheckoutPage },
      { path: "/orders/:ulid", element: <p>Order page</p> },
      { path: "/", element: <p>Home</p> },
      { path: "/cart", element: <p>Cart page</p> },
    ],
    { initialEntries: ["/checkout"] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, user: userEvent.setup(), ...view };
}

async function payWithCard(
  user: ReturnType<typeof userEvent.setup>,
  number = "4242424242424242",
) {
  await user.type(await screen.findByLabelText("Card number"), number);
  await user.type(screen.getByLabelText("Expiry"), "1229");
  await user.type(screen.getByLabelText("CVC"), "123");
  await user.type(screen.getByLabelText("Name on card"), "Jane Buyer");
  await user.click(screen.getByRole("button", { name: /^Pay/ }));
}

const twoLines = cart([
  cartLine(),
  cartLine({ offer_id: 2, line_total: { amount: 1001, currency: "EUR" } }),
]);

beforeEach(() => {
  authToken.set("token-a");
});

afterEach(() => {
  queryClient.clear();
  authToken.clear();
  vi.unstubAllGlobals();
});

describe("CheckoutPage", () => {
  // covers: AC-10
  it("renders one Checkout heading and the page title", async () => {
    stubApi({ "GET /cart": [cartAnswer(twoLines)] });

    renderCheckout();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Checkout" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(document.title).toBe("Checkout | Eneba Marketplace (demo)");
  });

  // covers: AC-10
  it("refetches the cart on mount and pays against the fresh total, not the cached one", async () => {
    queryClient.setQueryData(
      CART_KEY,
      cart([cartLine()], { total: { amount: 1000, currency: "EUR" } }),
    );
    const api = stubApi({
      "GET /cart": [
        cartAnswer(
          cart([cartLine()], { total: { amount: 2500, currency: "EUR" } }),
        ),
      ],
    });

    renderCheckout();

    expect(
      await screen.findByRole("button", { name: "Pay €25.00" }),
    ).toBeInTheDocument();
    expect(api.count("GET /cart")).toBe(1);
  });

  // covers: AC-10
  it("shows the empty state with a link to browse games", async () => {
    stubApi({ "GET /cart": [cartAnswer(cart([]))] });

    renderCheckout();

    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse games" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  // covers: AC-10
  it("blocks payment when an item is no longer available", async () => {
    stubApi({
      "GET /cart": [
        cartAnswer(
          cart([cartLine({ available: false })], { can_checkout: false }),
        ),
      ],
    });

    renderCheckout();

    expect(
      await screen.findByText("Some items are no longer available."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to cart" })).toHaveAttribute(
      "href",
      "/cart",
    );
    expect(
      screen.queryByRole("button", { name: /^Pay/ }),
    ).not.toBeInTheDocument();
  });

  // covers: AC-10
  it("shows an error state when the cart fails, and loads after Try again", async () => {
    stubApi({
      "GET /cart": [
        () => jsonResponse(400, { message: "Bad request." }),
        cartAnswer(twoLines),
      ],
    });
    const { user } = renderCheckout();

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("button", { name: "Pay €30.00" }),
    ).toBeInTheDocument();
  });

  // covers: AC-14
  it("pays the total on screen with a UUID key, empties the cart, and opens the order", async () => {
    const paid = order();
    const api = stubApi({
      "GET /cart": [cartAnswer(twoLines)],
      "POST /checkout": [() => jsonResponse(201, { data: paid })],
    });
    const { router, user } = renderCheckout();

    await payWithCard(user);

    expect(await screen.findByText("Order page")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/orders/${paid.ulid}`);
    const [checkout] = api.checkouts();
    expect(checkout.body).toEqual({
      card_number: "4242 4242 4242 4242",
      card_expiry: "12/29",
      card_cvc: "123",
      card_name: "Jane Buyer",
      expected_total: 3000,
    });
    expect(checkout.key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(queryClient.getQueryData(CART_KEY)).toEqual(EMPTY_CART);
    expect(queryClient.getQueryData(orderQueryKey(paid.ulid))).toEqual(paid);
  });

  // covers: AC-13
  it("shows a decline above Pay, keeps the card values, and retries with the same key", async () => {
    const api = stubApi({
      "GET /cart": [cartAnswer(twoLines)],
      "POST /checkout": [declined, () => jsonResponse(201, { data: order() })],
    });
    const { user } = renderCheckout();

    await payWithCard(user, "4000000000000002");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your card was declined.",
    );
    expect(screen.getByLabelText("Card number")).toHaveValue(
      "4000 0000 0000 0002",
    );

    await user.click(screen.getByRole("button", { name: /^Pay/ }));

    expect(await screen.findByText("Order page")).toBeInTheDocument();
    const [first, second] = api.checkouts();
    expect(second.key).toBe(first.key);
  });

  // Value sourcing: one idempotency key per page visit.
  it("uses a new idempotency key after the page is opened again", async () => {
    const api = stubApi({
      "GET /cart": [cartAnswer(twoLines)],
      "POST /checkout": [declined],
    });
    const first = renderCheckout();
    await payWithCard(first.user);
    await screen.findByRole("alert");
    first.unmount();

    const second = renderCheckout();
    await payWithCard(second.user);
    await screen.findByRole("alert");

    const [visitOne, visitTwo] = api.checkouts();
    expect(visitTwo.key).not.toBe(visitOne.key);
  });

  // covers: AC-4, AC-13
  it("shows the cart changed message and refreshes the total after a 409", async () => {
    const api = stubApi({
      "GET /cart": [
        cartAnswer(twoLines),
        cartAnswer(
          cart([cartLine()], { total: { amount: 3100, currency: "EUR" } }),
        ),
      ],
      "POST /checkout": [
        () =>
          jsonResponse(409, {
            message:
              "Your cart changed. Check the updated total and try again.",
          }),
      ],
    });
    const { user } = renderCheckout();

    await payWithCard(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your cart changed. Check the updated total and try again.",
    );
    expect(
      await screen.findByRole("button", { name: "Pay €31.00" }),
    ).toBeInTheDocument();
    expect(api.count("GET /cart")).toBe(2);
  });

  // covers: AC-13
  it("shows a server field error under its field and focuses it", async () => {
    stubApi({
      "GET /cart": [cartAnswer(twoLines)],
      "POST /checkout": [
        () =>
          jsonResponse(422, {
            message: "Enter a valid card number.",
            errors: { card_number: ["Enter a valid card number."] },
          }),
      ],
    });
    const { user } = renderCheckout();

    await payWithCard(user, "4242424242424241");

    await waitFor(() =>
      expect(screen.getByLabelText("Card number")).toHaveFocus(),
    );
    expect(screen.getByLabelText("Card number")).toHaveAccessibleDescription(
      "Enter a valid card number.",
    );
  });
});
