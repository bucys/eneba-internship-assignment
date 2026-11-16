// @vitest-environment jsdom
import "../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Banner, HomeBlock } from "../api/home";
import type { Product } from "../api/products";
import { jsonResponse } from "../test/fixtures";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const { queryClient } = await import("../lib/queryClient");
const { HomePage } = await import("./HomePage");
const { ToastProvider } = await import("../components/ui/Toast");
const { homeLoader } = await import("./homeLoader");
const { HOME_BLOCK_QUERIES } = await import("../api/home");

const LAYOUT: HomeBlock[] = [
  { type: "banners", title: "Featured" },
  { type: "best_sellers", title: "Best sellers" },
  { type: "deals", title: "Deals" },
  { type: "products", title: "Browse games" },
];

function product(name: string): Product {
  const slug = name.toLowerCase().replace(/\W+/g, "-");
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

function products(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) =>
    product(`${prefix} ${index + 1}`),
  );
}

const banner: Banner = {
  id: 1,
  title: "Shadow of the Erdtree",
  tagline: "Cross into the Land of Shadow.",
  cta_label: "Buy now",
  image_url: "",
  product: product("Elden Ring Shadow of the Erdtree"),
};

type Routes = Partial<Record<string, () => Response | Promise<Response>>>;

function stubApi(overrides: Routes = {}) {
  const routes: Routes = {
    "/api/v1/home": () => jsonResponse(200, { data: LAYOUT }),
    "/api/v1/home/banners": () => jsonResponse(200, { data: [banner] }),
    "/api/v1/home/best-sellers": () =>
      jsonResponse(200, { data: products("Seller", 3) }),
    "/api/v1/home/deals": () =>
      jsonResponse(200, { data: products("Deal", 3) }),
    "/api/v1/products": () =>
      jsonResponse(200, {
        data: products("Grid", 2),
        links: { first: null, last: null, prev: null, next: null },
        meta: { current_page: 1, last_page: 1, per_page: 24, total: 2 },
      }),
    ...overrides,
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const answer = routes[url.pathname];
    if (!answer) throw new Error(`unexpected request ${url}`);
    return answer();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function callsTo(fetchMock: ReturnType<typeof stubApi>, path: string) {
  return fetchMock.mock.calls.filter(
    ([input]) => new URL(String(input)).pathname === path,
  ).length;
}

function serverError() {
  return jsonResponse(500, { message: "Server Error" });
}

function renderHome() {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <ToastProvider>
          <HomePage />
        </ToastProvider>
      ),
    },
  ]);
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// The real `/` route: the loader prefetches before HomePage mounts.
function renderHomeRoute() {
  const router = createMemoryRouter([
    {
      path: "/",
      loader: homeLoader,
      element: (
        <ToastProvider>
          <HomePage />
        </ToastProvider>
      ),
    },
  ]);
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const HOME_PATHS = [
  "/api/v1/home",
  "/api/v1/home/banners",
  "/api/v1/home/best-sellers",
  "/api/v1/home/deals",
  "/api/v1/products",
];

// A layout response the test releases by hand, to hold the page on its skeleton.
function heldLayout() {
  let release = () => {};
  const response = new Promise<Response>((resolve) => {
    release = () => resolve(jsonResponse(200, { data: LAYOUT }));
  });
  return { answer: () => response, release: () => release() };
}

function band(name: string) {
  return screen.getByRole("region", { name });
}

// A block's skeleton band and its loaded band are different elements, so look the band up again.
function inBand(name: string) {
  return {
    findByText: (text: string) =>
      waitFor(() => within(band(name)).getByText(text)),
    findTryAgain: () =>
      waitFor(() =>
        within(band(name)).getByRole("button", { name: "Try again" }),
      ),
  };
}

beforeEach(() => {
  queryClient.clear();
  // The shared client retries 5xx after 3 s; these tests check the first failure.
  queryClient.setDefaultOptions({ queries: { retry: false } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HomePage", () => {
  it("renders the hidden h1 and every block in layout order", async () => {
    stubApi();
    renderHome();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Buy game keys at the best prices",
      }),
    ).toBeInTheDocument();
    await screen.findByText("Seller 1");
    await screen.findByText("Grid 1");

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Featured",
      "Best sellers",
      "Deals",
      "Browse games",
    ]);
    expect(
      screen.getByRole("link", { name: /Shadow of the Erdtree/ }),
    ).toHaveAttribute("href", "/products/elden-ring-shadow-of-the-erdtree");
    expect(
      within(band("Browse games")).getByRole("link", { name: "See all" }),
    ).toHaveAttribute("href", "/store");
  });

  it("keeps the other blocks when one block's request fails", async () => {
    const fetchMock = stubApi({ "/api/v1/home/deals": serverError });
    const user = userEvent.setup();
    renderHome();

    const tryAgain = await inBand("Deals").findTryAgain();
    expect(await screen.findByText("Seller 1")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Shadow of the Erdtree/ }),
    ).toBeInTheDocument();

    stubApi({});
    await user.click(tryAgain);

    await inBand("Deals").findByText("Deal 1");
    expect(callsTo(fetchMock, "/api/v1/home/best-sellers")).toBe(1);
  });

  it("renders nothing for an empty block or an unknown block type", async () => {
    stubApi({
      "/api/v1/home": () =>
        jsonResponse(200, {
          data: [
            { type: "best_sellers", title: "Best sellers" },
            { type: "recently_viewed", title: "Recently viewed" },
            { type: "deals", title: "Deals" },
          ],
        }),
      "/api/v1/home/best-sellers": () => jsonResponse(200, { data: [] }),
    });
    renderHome();

    await screen.findByText("Deal 1");
    expect(
      screen.queryByRole("region", { name: "Best sellers" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Recently viewed")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });

  it("shows only the page error when the layout fails", async () => {
    const fetchMock = stubApi({ "/api/v1/home": serverError });
    renderHome();

    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state when the layout has no known block", async () => {
    stubApi({
      "/api/v1/home": () =>
        jsonResponse(200, { data: [{ type: "constructor", title: "x" }] }),
    });
    renderHome();

    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText("Check back soon.")).toBeInTheDocument();
  });

  it("contains a render crash to its block and recovers on Try again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = { ...product("Broken"), platform: null };
    const fetchMock = stubApi({
      "/api/v1/home/best-sellers": () => jsonResponse(200, { data: [broken] }),
    });
    const user = userEvent.setup();
    renderHome();

    const tryAgain = await inBand("Best sellers").findTryAgain();
    expect(await screen.findByText("Deal 1")).toBeInTheDocument();

    stubApi({});
    await user.click(tryAgain);

    await inBand("Best sellers").findByText("Seller 1");
    expect(callsTo(fetchMock, "/api/v1/home/deals")).toBe(1);
  });

  it("shows 4 items on mobile, then all of them with focus on the 5th", async () => {
    stubApi({
      "/api/v1/home": () =>
        jsonResponse(200, {
          data: [{ type: "best_sellers", title: "Best sellers" }],
        }),
      "/api/v1/home/best-sellers": () =>
        jsonResponse(200, { data: products("Seller", 12) }),
    });
    const user = userEvent.setup();
    renderHome();

    await inBand("Best sellers").findByText("Seller 4");
    const sellers = band("Best sellers");
    expect(within(sellers).getAllByRole("link")).toHaveLength(4);

    const showAll = within(sellers).getByRole("button", { name: "Show all" });
    expect(showAll).toHaveAttribute("aria-expanded", "false");
    expect(showAll).toHaveAttribute(
      "aria-controls",
      within(sellers).getByRole("list").id,
    );

    await user.click(showAll);

    expect(within(sellers).getAllByRole("link")).toHaveLength(12);
    expect(
      within(sellers).queryByRole("button", { name: "Show all" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(sellers).getByRole("link", { name: /Seller 5/ }),
      ).toHaveFocus(),
    );
  });

  it("hides Show all with 4 or fewer items", async () => {
    stubApi({
      "/api/v1/home": () =>
        jsonResponse(200, {
          data: [{ type: "best_sellers", title: "Best sellers" }],
        }),
      "/api/v1/home/best-sellers": () =>
        jsonResponse(200, { data: products("Seller", 4) }),
    });
    renderHome();

    await screen.findByText("Seller 4");
    expect(
      screen.queryByRole("button", { name: "Show all" }),
    ).not.toBeInTheDocument();
  });

  it("shows every item in one rail, without Show all, on desktop", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(min-width: 768px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    stubApi({
      "/api/v1/home": () =>
        jsonResponse(200, { data: [{ type: "deals", title: "Deals" }] }),
      "/api/v1/home/deals": () =>
        jsonResponse(200, { data: products("Deal", 12) }),
    });
    renderHome();

    await inBand("Deals").findByText("Deal 12");
    const deals = band("Deals");
    expect(
      within(deals).getAllByRole("link", { name: /^Steam Deal \d+/ }),
    ).toHaveLength(12);
    expect(
      within(deals).queryByRole("button", { name: "Show all" }),
    ).not.toBeInTheDocument();
  });

  it("mounts only the split hero from lg", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(min-width: 64rem)" || query === "(min-width: 768px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    stubApi({
      "/api/v1/home": () =>
        jsonResponse(200, { data: [{ type: "banners", title: "Featured" }] }),
    });
    renderHome();

    const hero = await screen.findByRole("region", { name: "Featured" });
    const links = await within(hero).findAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveClass("col-span-3");
    expect(
      within(hero).queryByRole("button", { name: /Scroll Featured/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the platform shortcuts right after the hero", async () => {
    stubApi();
    renderHome();

    const nav = await screen.findByRole("navigation", {
      name: "Shop by platform",
    });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "All games",
      "Steam",
      "PlayStation",
      "Xbox",
      "Nintendo",
    ]);
    expect(links[0]).toHaveAttribute("href", "/store");
    expect(links[4]).toHaveAttribute("href", "/store?platform=nintendo");
    const hero = await screen.findByRole("region", { name: "Featured" });
    expect(hero.nextElementSibling).toContainElement(nav);
  });
});

describe("home route prefetch", () => {
  it("starts all five requests before the layout resolves, once each", async () => {
    const layout = heldLayout();
    const fetchMock = stubApi({ "/api/v1/home": layout.answer });
    renderHomeRoute();

    await waitFor(() =>
      HOME_PATHS.forEach((path) => expect(callsTo(fetchMock, path)).toBe(1)),
    );
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);

    layout.release();

    await screen.findByText("Seller 1");
    await screen.findByText("Grid 1");
    await screen.findByText("Deal 1");
    HOME_PATHS.forEach((path) => expect(callsTo(fetchMock, path)).toBe(1));
  });

  it("does not fetch again while the cache is fresh", async () => {
    const fetchMock = stubApi();
    homeLoader();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    homeLoader();

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("shows the block's Try again when its prefetch fails", async () => {
    const layout = heldLayout();
    const fetchMock = stubApi({
      "/api/v1/home": layout.answer,
      "/api/v1/home/banners": serverError,
    });
    const user = userEvent.setup();
    renderHomeRoute();

    const bannersKey = HOME_BLOCK_QUERIES.banners().queryKey;
    await waitFor(() =>
      expect(queryClient.getQueryState(bannersKey)?.status).toBe("error"),
    );
    layout.release();

    const tryAgain = await inBand("Featured").findTryAgain();
    expect(await screen.findByText("Seller 1")).toBeInTheDocument();
    // The prefetch failed, so the block's own query fetched once more on mount.
    expect(callsTo(fetchMock, "/api/v1/home/banners")).toBe(2);

    stubApi({});
    await user.click(tryAgain);

    expect(
      await screen.findByRole("link", { name: /Shadow of the Erdtree/ }),
    ).toBeInTheDocument();
  });
});
