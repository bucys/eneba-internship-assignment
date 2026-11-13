// @vitest-environment jsdom
import "../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../api/products";
import { jsonResponse } from "../test/fixtures";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const { queryClient } = await import("../lib/queryClient");
const { StorePage } = await import("./StorePage");
const { storeLoader } = await import("./storeLoader");
const { SearchForm } = await import("../components/layout/SearchForm");

function product(slug: string, name = slug): Product {
  return {
    slug,
    name,
    type: "game",
    cover_image_url: "",
    platform: { slug: "steam", name: "Steam" },
    region: { slug: "global", name: "Global" },
    price: { amount: 999, currency: "EUR" },
    list_price: null,
    discount_percent: null,
  };
}

function page(
  data: Product[],
  meta: { current_page?: number; last_page?: number; total?: number } = {},
) {
  return {
    data,
    links: { first: null, last: null, prev: null, next: null },
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 24,
      total: data.length,
      ...meta,
    },
  };
}

const filterOptions = {
  data: {
    platforms: [
      { slug: "steam", name: "Steam" },
      { slug: "xbox", name: "Xbox" },
    ],
    regions: [{ slug: "europe", name: "Europe" }],
  },
};

type Answer = (search: URLSearchParams) => Response | Promise<Response>;

function stubApi({
  products = () => jsonResponse(200, page([product("hades", "Hades")])),
  filters = () => jsonResponse(200, filterOptions),
}: { products?: Answer; filters?: () => Response } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/products") return products(url.searchParams);
    if (url.pathname === "/api/v1/catalog/filters") return filters();
    throw new Error(`unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function productCalls(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input)))
    .filter((url) => url.pathname === "/api/v1/products")
    .map((url) => url.search);
}

function renderStore(url = "/store") {
  const router = createMemoryRouter(
    [
      {
        path: "/store",
        loader: storeLoader,
        element: (
          <>
            <SearchForm />
            <StorePage />
          </>
        ),
      },
    ],
    { initialEntries: [url] },
  );
  const pushes: string[] = [];
  router.subscribe((state) => {
    if (state.navigation.state === "idle" && state.historyAction === "PUSH") {
      pushes.push(state.location.search);
    }
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, pushes };
}

function stubDesktop(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

/** A viewport that starts below lg; `widen()` crosses lg and fires the change listeners. */
function stubResizableViewport() {
  let matches = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  return {
    widen() {
      matches = true;
      listeners.forEach((listener) => listener());
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  stubDesktop(true);
});

afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe("StorePage URL", () => {
  // covers: spec 0012 AC-5
  it("replaces a non canonical URL with the canonical one", async () => {
    const fetchMock = stubApi();
    const { router } = renderStore(
      "/store?page=1&sort=name&utm=x&price_max=007&platform=steam%2Cxbox",
    );

    await screen.findByText("Hades");
    expect(router.state.location.search).toBe("?platform=steam,xbox");
    expect(router.state.historyAction).toBe("REPLACE");
    expect(productCalls(fetchMock)).toEqual(["?platform=steam,xbox"]);
  });

  // covers: spec 0012 AC-5
  it("pushes one entry per change and back undoes it", async () => {
    stubApi();
    const user = userEvent.setup();
    const { router, pushes } = renderStore();

    await user.click(await screen.findByRole("checkbox", { name: "Steam" }));
    await user.click(screen.getByRole("checkbox", { name: "Xbox" }));
    expect(pushes).toEqual(["?platform=steam", "?platform=steam,xbox"]);

    await router.navigate(-1);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Xbox" })).not.toBeChecked(),
    );
    expect(router.state.location.search).toBe("?platform=steam");
    expect(screen.getByRole("checkbox", { name: "Steam" })).toBeChecked();
  });

  // covers: spec 0012 AC-5
  it("pushes nothing for a change that keeps the URL", async () => {
    stubApi();
    const user = userEvent.setup();
    const { pushes } = renderStore("/store?price_min=10");

    const min = await screen.findByRole("textbox", { name: "Min" });
    await user.click(min);
    await user.keyboard("{Enter}");
    await user.tab();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort by" }),
      "name",
    );

    expect(pushes).toEqual([]);
  });

  // covers: spec 0012 AC-5 (review: a no op on page 2+ must keep the page)
  it("keeps the page and pushes nothing for a no op change on a later page", async () => {
    stubApi({
      products: (search) =>
        jsonResponse(
          200,
          page([product(`p${search.get("page") ?? 1}`)], {
            current_page: Number(search.get("page") ?? 1),
            last_page: 3,
            total: 60,
          }),
        ),
    });
    const user = userEvent.setup();
    const { router, pushes } = renderStore("/store?price_min=10&page=2");

    await screen.findByText("p2");
    const min = screen.getByRole("textbox", { name: "Min" });
    await user.click(min);
    await user.keyboard("{Enter}");
    await user.tab();
    await user.tab();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort by" }),
      "name",
    );

    expect(pushes).toEqual([]);
    expect(router.state.location.search).toBe("?price_min=10&page=2");

    await user.click(screen.getByRole("checkbox", { name: "Steam" }));
    expect(pushes).toEqual(["?platform=steam&price_min=10"]);
  });

  // covers: spec 0012 AC-5
  it("drops the page on a filter change and keeps every param on a page link", async () => {
    stubApi({
      products: (search) =>
        jsonResponse(
          200,
          page([product(`p${search.get("page") ?? 1}`)], {
            current_page: Number(search.get("page") ?? 1),
            last_page: 3,
            total: 60,
          }),
        ),
    });
    const user = userEvent.setup();
    const { router } = renderStore("/store?sort=price_asc&page=2");

    const nav = await screen.findByRole("navigation", { name: "Store pages" });
    expect(within(nav).getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      "/store?sort=price_asc&page=3",
    );
    expect(within(nav).getByRole("link", { name: /Previous/ })).toHaveAttribute(
      "href",
      "/store?sort=price_asc",
    );

    await user.click(within(nav).getByRole("link", { name: /Next/ }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });

    await user.click(screen.getByRole("checkbox", { name: "Steam" }));
    expect(router.state.location.search).toBe("?platform=steam&sort=price_asc");
  });
});

describe("StorePage results", () => {
  // covers: spec 0012 AC-8
  it("shows the count, the cards, and the search heading", async () => {
    stubApi({
      products: () =>
        jsonResponse(200, page([product("witcher-3", "The Witcher 3")])),
    });
    renderStore("/store?q=witcher");

    expect(await screen.findByText("The Witcher 3")).toBeInTheDocument();
    expect(screen.getByText("1 result")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: 'Results for "witcher"' }),
    ).toBeInTheDocument();
    expect(document.title).toBe(
      'Results for "witcher" | Eneba Marketplace (demo)',
    );
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue(
      "witcher",
    );
  });

  // covers: spec 0012 AC-8
  it("moves a page beyond the last to the last page without the empty state", async () => {
    stubApi({
      products: (search) =>
        search.get("page") === "9"
          ? jsonResponse(
              200,
              page([], { current_page: 9, last_page: 4, total: 80 }),
            )
          : jsonResponse(
              200,
              page([product("last")], {
                current_page: 4,
                last_page: 4,
                total: 80,
              }),
            ),
    });
    const { router } = renderStore("/store?page=9");

    await screen.findByText("last");
    expect(router.state.location.search).toBe("?page=4");
    expect(router.state.historyAction).toBe("REPLACE");
    expect(screen.queryByText("No products match")).not.toBeInTheDocument();
  });

  // covers: spec 0012 AC-9
  it("shows the empty state, and Clear filters goes to /store", async () => {
    stubApi({
      products: (search) =>
        search.toString() === ""
          ? jsonResponse(200, page([product("hades", "Hades")]))
          : jsonResponse(200, page([])),
    });
    const user = userEvent.setup();
    const { router } = renderStore("/store?q=zzz&platform=steam");

    expect(await screen.findByText("No products match")).toBeInTheDocument();
    expect(screen.queryByText(/results?$/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(router.state.location.search).toBe("");
    expect(await screen.findByText("Hades")).toBeInTheDocument();
  });

  // covers: spec 0012 AC-9
  it("shows the invalid link message on a 422 and keeps the filters", async () => {
    stubApi({
      products: () =>
        jsonResponse(422, {
          message: "The selected platform is invalid.",
          errors: { platform: ["The selected platform is invalid."] },
        }),
    });
    renderStore("/store?platform=sega");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Some filters in this link are not valid.");
    expect(
      within(alert).getByRole("button", { name: "Clear filters" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: sega" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Steam" })).toBeInTheDocument();
  });

  // covers: spec 0012 AC-9
  it("shows the 429 wait with Try again", async () => {
    stubApi({
      products: () =>
        jsonResponse(
          429,
          { message: "Too Many Attempts." },
          { "Retry-After": "12" },
        ),
    });
    renderStore();

    expect(
      await screen.findByText("Too many requests. Try again in 12 seconds."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  // covers: spec 0012 AC-9
  it("keeps the previous results dimmed while the next ones load", async () => {
    let release: (() => void) | undefined;
    stubApi({
      products: (search) =>
        search.has("platform")
          ? new Promise((resolve) => {
              release = () =>
                resolve(jsonResponse(200, page([product("next")])));
            })
          : jsonResponse(200, page([product("first")])),
    });
    const user = userEvent.setup();
    renderStore();

    await screen.findByText("first");
    await user.click(screen.getByRole("checkbox", { name: "Steam" }));

    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("first").closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    release?.();
    expect(await screen.findByText("next")).toBeInTheDocument();
  });

  // covers: spec 0012 AC-9
  it("keeps price, sort, and results working when the filter options fail", async () => {
    stubApi({ filters: () => jsonResponse(500, { message: "Server Error" }) });
    renderStore("/store?platform=steam");

    expect(
      await screen.findByText("Filters could not load.", {}, { timeout: 6000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hades")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Min" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: steam" }),
    ).toBeInTheDocument();
  }, 10_000);
});

describe("StorePage filters", () => {
  // covers: spec 0012 AC-6
  it("validates the price fields inline and applies nothing", async () => {
    stubApi();
    const user = userEvent.setup();
    const { pushes } = renderStore("/store?price_max=10");

    const min = await screen.findByRole("textbox", { name: "Min" });
    await user.type(min, "5.5{Enter}");
    expect(
      screen.getByText("Enter a whole number from 0 to 10000"),
    ).toBeInTheDocument();

    await user.clear(min);
    await user.type(min, "50{Enter}");
    expect(screen.getByText("Min must not exceed max")).toBeInTheDocument();
    expect(pushes).toEqual([]);

    await user.clear(min);
    await user.type(min, "5");
    await user.tab();
    expect(pushes).toEqual(["?price_min=5&price_max=10"]);
    expect(
      screen.queryByText("Min must not exceed max"),
    ).not.toBeInTheDocument();
  });

  // covers: spec 0012 AC-6, AC-7
  it("resets the price drafts when a chip removes the bound", async () => {
    stubApi();
    const user = userEvent.setup();
    renderStore("/store?price_min=10&price_max=30");

    const min = await screen.findByRole("textbox", { name: "Min" });
    expect(min).toHaveValue("10");
    await user.clear(min);
    await user.type(min, "abc");

    await user.click(
      screen.getByRole("button", { name: "Remove filter: €10 to €30" }),
    );
    expect(screen.getByRole("textbox", { name: "Min" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Max" })).toHaveValue("");
  });

  // covers: spec 0012 AC-7
  it("Clear all keeps the search and removes everything else", async () => {
    stubApi();
    const user = userEvent.setup();
    const { router } = renderStore(
      "/store?q=hades&platform=steam&price_min=5&sort=price_desc",
    );

    await user.click(await screen.findByRole("button", { name: "Clear all" }));
    expect(router.state.location.search).toBe("?q=hades");
    expect(
      screen.queryByRole("button", { name: "Clear all" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: Search: hades" }),
    ).toBeInTheDocument();
  });

  // covers: spec 0012 AC-10
  it("starts a fresh search from the header and drops every other param", async () => {
    stubApi();
    const user = userEvent.setup();
    const { router, pushes } = renderStore(
      "/store?platform=steam&sort=price_asc",
    );

    const search = await screen.findByRole("searchbox", { name: "Search" });
    await user.type(search, "  doom  {Enter}");
    expect(router.state.location.search).toBe("?q=doom");

    await user.keyboard("{Enter}");
    expect(pushes).toEqual(["?q=doom"]);
    expect(search).toHaveAttribute("maxLength", "100");
  });
});

describe("StorePage mobile dialog", () => {
  beforeEach(() => {
    stubDesktop(false);
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });
  });

  // covers: spec 0012 AC-6
  it("opens the panel in a dialog that applies live and closes back to the button", async () => {
    stubApi({
      products: (search) =>
        jsonResponse(
          200,
          page(
            search.has("platform")
              ? [product("a")]
              : [product("a"), product("b")],
          ),
        ),
    });
    const user = userEvent.setup();
    const { pushes } = renderStore();

    expect(
      screen.queryByRole("checkbox", { name: "Steam" }),
    ).not.toBeInTheDocument();
    const button = await screen.findByRole("button", { name: "Filters" });
    await user.click(button);

    const dialog = screen.getByRole("dialog", { name: "Filters" });
    await user.click(within(dialog).getByRole("checkbox", { name: "Steam" }));
    expect(pushes).toEqual(["?platform=steam"]);
    expect(
      await within(dialog).findByRole("button", { name: "Show 1 result" }),
    ).toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe("hidden");

    await user.click(
      within(dialog).getByRole("button", { name: "Show 1 result" }),
    );
    expect(
      screen.queryByRole("checkbox", { name: "Steam" }),
    ).not.toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe("");
    expect(
      screen.getByRole("button", { name: "Filters, 1 active" }),
    ).toHaveFocus();
  });

  // covers: spec 0012 AC-6 (review: scroll lock restores the previous value)
  it("locks page scroll while open and restores the previous value on close", async () => {
    stubApi();
    const user = userEvent.setup();
    const root = document.documentElement;
    root.style.overflow = "clip";
    renderStore();

    await user.click(await screen.findByRole("button", { name: "Filters" }));
    expect(root.style.overflow).toBe("hidden");

    await user.click(screen.getByRole("button", { name: "Close filters" }));
    expect(root.style.overflow).toBe("clip");
    root.style.overflow = "";
  });

  // covers: spec 0012 AC-6 (review: crossing lg closes the dialog)
  it("closes the dialog and shows the sidebar when the viewport widens past lg", async () => {
    stubApi();
    const viewport = stubResizableViewport();
    const user = userEvent.setup();
    renderStore();

    await user.click(await screen.findByRole("button", { name: "Filters" }));
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe("hidden");

    act(() => viewport.widen());

    expect(
      screen.queryByRole("dialog", { name: "Filters" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Filters" }),
    ).not.toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe("");
    const sidebar = screen.getByRole("complementary", { name: "Filters" });
    expect(
      within(sidebar).getAllByRole("checkbox", { name: "Steam" }),
    ).toHaveLength(1);
    expect(screen.getAllByRole("checkbox", { name: "Steam" })).toHaveLength(1);
  });
});
