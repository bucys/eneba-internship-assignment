// @vitest-environment jsdom
import "../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderSummary } from "../api/orders";
import { jsonResponse, orderSummary } from "../test/fixtures";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const { queryClient } = await import("../lib/queryClient");
const { OrdersPage } = await import("./OrdersPage");

function paginated(
  data: OrderSummary[],
  meta: { current_page?: number; last_page?: number; total?: number } = {},
) {
  return {
    data,
    links: { first: null, last: null, prev: null, next: null },
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 10,
      total: data.length,
      ...meta,
    },
  };
}

type Answer = () => Response | Promise<Response>;

/** Answers GET /orders?page=N from the map; anything else is a test failure. */
function stubOrders(pages: Record<number, Answer>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname !== "/api/v1/orders") {
      throw new Error(`unexpected request ${url}`);
    }
    const answer = pages[Number(url.searchParams.get("page"))];
    if (!answer) throw new Error(`no answer for ${url}`);
    return answer();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderOrders(url = "/orders") {
  const router = createMemoryRouter(
    [
      { path: "/orders", Component: OrdersPage },
      { path: "/orders/:ulid", Component: () => <p>order page</p> },
    ],
    { initialEntries: [url] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const multi = orderSummary({
  ulid: "01jhistoryorder00000abcdez",
  item_count: 3,
  line_count: 3,
  total: { amount: 5997, currency: "EUR" },
  first_item: { product_name: "Hades", cover_image_url: null },
});
const single = orderSummary({
  ulid: "01jhistoryorder00000zzzzzz",
  item_count: 1,
  line_count: 1,
});

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe("OrdersPage", () => {
  // covers: spec 0011 AC-3
  it("shows one summary link per order with every row field", async () => {
    const fetchMock = stubOrders({
      1: () => jsonResponse(200, paginated([multi, single])),
    });

    const router = renderOrders();

    const list = await screen.findByRole("list", { name: "Orders" });
    expect(document.title).toBe("My orders | Eneba Marketplace (demo)");
    expect(
      screen.getByRole("heading", { level: 1, name: "My orders" }),
    ).toBeInTheDocument();

    const rows = within(list).getAllByRole("link");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("href", `/orders/${multi.ulid}`);
    expect(rows[0]).toHaveTextContent("Hades and 2 more products");
    expect(rows[0]).toHaveTextContent("3 items");
    expect(rows[0]).toHaveTextContent("#00ABCDEZ");
    expect(rows[0]).toHaveTextContent("Paid");
    expect(rows[0]).toHaveTextContent("€59.97");
    expect(rows[0].querySelector("time")).toHaveAttribute(
      "datetime",
      multi.paid_at,
    );
    expect(rows[1]).toHaveTextContent("Elden Ring");
    expect(rows[1]).not.toHaveTextContent("more product");
    expect(rows[1]).toHaveTextContent("1 item");
    expect(rows[1].querySelector("img")).toHaveAttribute("alt", "");

    expect(
      screen.queryByRole("navigation", { name: "Order pages" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await userEvent.click(rows[1]);
    expect(router.state.location.pathname).toBe(`/orders/${single.ulid}`);
    expect(router.state.location.state).toEqual({ fromPage: 1 });
  });

  // covers: spec 0011 AC-4
  it("pages with Next, keeping the old rows until the next page arrives", async () => {
    let resolvePage2: (response: Response) => void = () => {};
    stubOrders({
      1: () =>
        jsonResponse(200, paginated([single], { last_page: 2, total: 11 })),
      2: () =>
        new Promise<Response>((resolve) => {
          resolvePage2 = resolve;
        }),
    });

    const router = renderOrders();

    const nav = await screen.findByRole("navigation", { name: "Order pages" });
    expect(nav).toHaveTextContent("Page 1 of 2");
    const previous = within(nav).getByText("Previous");
    expect(previous.closest("span[aria-disabled='true']")).not.toBeNull();
    expect(within(nav).queryByRole("link", { name: "Previous" })).toBeNull();

    await userEvent.click(within(nav).getByRole("link", { name: "Next" }));
    expect(router.state.location.search).toBe("?page=2");
    expect(screen.getByText("Elden Ring")).toBeInTheDocument();
    expect(window.scrollTo).not.toHaveBeenCalled();

    resolvePage2(
      jsonResponse(
        200,
        paginated([multi], { current_page: 2, last_page: 2, total: 11 }),
      ),
    );

    expect(await screen.findByText("Hades")).toBeInTheDocument();
    expect(screen.queryByText("Elden Ring")).not.toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    const lastNav = screen.getByRole("navigation", { name: "Order pages" });
    expect(lastNav).toHaveTextContent("Page 2 of 2");
    expect(
      within(lastNav).getByRole("link", { name: "Previous" }),
    ).toHaveAttribute("href", "/orders");
    expect(within(lastNav).queryByRole("link", { name: "Next" })).toBeNull();

    await userEvent.click(screen.getByRole("link", { name: /Hades/ }));
    expect(router.state.location.state).toEqual({ fromPage: 2 });
  });

  // covers: spec 0011 AC-4
  it.each(["?page=1", "?page=abc", "?page=0"])(
    "replaces %s with /orders",
    async (search) => {
      stubOrders({ 1: () => jsonResponse(200, paginated([single])) });

      const router = renderOrders(`/orders${search}`);

      await waitFor(() => expect(router.state.location.search).toBe(""));
      expect(router.state.historyAction).toBe("REPLACE");
      expect(await screen.findByText("Elden Ring")).toBeInTheDocument();
    },
  );

  // covers: spec 0011 AC-4
  it("replaces a page beyond the last with the last page and never shows the empty state", async () => {
    stubOrders({
      9: () =>
        jsonResponse(
          200,
          paginated([], { current_page: 9, last_page: 2, total: 11 }),
        ),
      2: () =>
        jsonResponse(
          200,
          paginated([multi], { current_page: 2, last_page: 2, total: 11 }),
        ),
    });

    const router = renderOrders("/orders?page=9");

    expect(await screen.findByText("Hades")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?page=2");
    expect(router.state.historyAction).toBe("REPLACE");
    expect(screen.queryByText("No orders yet")).not.toBeInTheDocument();
  });

  // covers: spec 0011 AC-5
  it("shows the empty state with a way to the store", async () => {
    stubOrders({ 1: () => jsonResponse(200, paginated([])) });

    renderOrders();

    expect(
      await screen.findByRole("heading", { name: "No orders yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Keys you buy will appear here."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse games" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  // covers: spec 0011 AC-5
  it("shows the wait on a 429 and refetches on Try again", async () => {
    let calls = 0;
    stubOrders({
      1: () => {
        calls += 1;
        return calls === 1
          ? jsonResponse(
              429,
              { message: "Too Many Attempts." },
              { "Retry-After": "30" },
            )
          : jsonResponse(200, paginated([single]));
      },
    });

    renderOrders();

    expect(
      await screen.findByText("Too many requests. Try again in 30 seconds."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Elden Ring")).toBeInTheDocument();
  });
});
