// @vitest-environment jsdom
import "../../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Money } from "../../lib/money";
import { jsonResponse } from "../../test/fixtures";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

const { guestCart } = await import("../../lib/guestCart");
const { queryClient } = await import("../../lib/queryClient");
const { ToastProvider } = await import("../ui/Toast");
const { ProductCard } = await import("./ProductCard");

const PRICE: Money = { amount: 999, currency: "EUR" };

function renderCard(price: Money | null = PRICE) {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <ToastProvider>
          <ProductCard
            slug="hades"
            name="Hades"
            coverImageUrl={null}
            platformName="Steam"
            regionName="Europe"
            price={price}
            listPrice={null}
            discountPercent={null}
          />
        </ToastProvider>
      ),
    },
    { path: "/products/:slug", element: <p>Product page</p> },
  ]);
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

function offer(id: number, stock: number) {
  return {
    id,
    price: PRICE,
    stock,
    seller: { name: `Seller ${id}`, rating_basis_points: 0, rating_count: 0 },
  };
}

function stubDetail(response: () => Response) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function detail(bestOfferId: number | null) {
  return jsonResponse(200, {
    data: {
      slug: "hades",
      best_offer_id: bestOfferId,
      offers: [offer(3, 4), offer(8, 2)],
    },
  });
}

afterEach(() => {
  guestCart.clear();
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe("ProductCard", () => {
  it("links the card body to the product and View offers to its offers", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /^Steam Hades/ })).toHaveAttribute(
      "href",
      "/products/hades",
    );
    expect(
      screen.getByRole("link", { name: "View offers for Hades" }),
    ).toHaveAttribute("href", "/products/hades#offers");
  });

  it("uppercases the region with CSS, keeping the DOM text", () => {
    renderCard();

    const region = screen.getByText("Europe");
    expect(region).toHaveClass("uppercase");
    expect(screen.getByText("Steam")).toBeInTheDocument();
  });

  it("shows no cart actions when nothing can be bought", () => {
    renderCard(null);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /View offers/ }),
    ).not.toBeInTheDocument();
  });
});

// The compact button shows below md, the full actions from md; jsdom applies no CSS, so both render.
describe("ProductCard quick add", () => {
  it("adds the server's best offer without leaving the page", async () => {
    const fetchMock = stubDetail(() => detail(8));
    const router = renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "Add Hades to cart" }),
    );

    expect(await screen.findByText("Added to cart.")).toBeInTheDocument();
    expect(guestCart.get()).toEqual([{ offer_id: 8, quantity: 1 }]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.example.test/api/v1/products/hades",
    );
    expect(router.state.location.pathname).toBe("/");
  });

  it("adds from the full Add to cart button too", async () => {
    stubDetail(() => detail(3));
    renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "Add to cart, Hades" }),
    );

    expect(await screen.findByText("Added to cart.")).toBeInTheDocument();
    expect(guestCart.get()).toEqual([{ offer_id: 3, quantity: 1 }]);
  });

  it("says out of stock when the product has no best offer", async () => {
    stubDetail(() => detail(null));
    renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "Add Hades to cart" }),
    );

    expect(
      await screen.findByText("This product is out of stock."),
    ).toBeInTheDocument();
    expect(guestCart.get()).toEqual([]);
  });

  it("shows the add error when the product cannot be loaded", async () => {
    stubDetail(() => jsonResponse(404, { message: "Not Found" }));
    renderCard();

    await userEvent.click(
      screen.getByRole("button", { name: "Add Hades to cart" }),
    );

    expect(
      await screen.findByText("Could not add to cart. Please try again."),
    ).toBeInTheDocument();
    expect(guestCart.get()).toEqual([]);
  });
});
