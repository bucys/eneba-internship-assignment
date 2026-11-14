// @vitest-environment jsdom
import "../../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Offer, ProductDetail } from "../../api/products";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

const { queryClient } = await import("../../lib/queryClient");
const { ToastProvider } = await import("../ui/Toast");
const { BuyBox } = await import("./BuyBox");

function offer(
  id: number,
  amount: number,
  stock: number,
  seller: string,
): Offer {
  return {
    id,
    price: { amount, currency: "EUR" },
    stock,
    seller: { name: seller, rating_basis_points: 9500, rating_count: 10 },
  };
}

function product(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    slug: "hades",
    name: "Hades",
    type: "game",
    cover_image_url: "",
    platform: { slug: "steam", name: "Steam" },
    region: { slug: "global", name: "Global" },
    price: { amount: 1000, currency: "EUR" },
    list_price: null,
    discount_percent: null,
    description: null,
    developer: null,
    publisher: null,
    release_date: null,
    best_offer_id: 1,
    offers: [
      offer(1, 1000, 5, "Loot Lane"),
      offer(2, 1350, 3, "Key Hub"),
      offer(3, 1200, 0, "Empty Shelf"),
      offer(4, 1500, 2, "Pixel Port"),
    ],
    ...overrides,
  };
}

function renderBuyBox(detail: ProductDetail) {
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <BuyBox product={detail} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("BuyBox", () => {
  it("shows the best offer's seller and links to the other in stock offers", () => {
    renderBuyBox(product());

    expect(screen.getByText("Best offer")).toBeInTheDocument();
    expect(screen.getByText("Loot Lane")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "+2 offers from €13.50" });
    expect(link).toHaveAttribute("href", "#offers");
  });

  it("hides the offers link when no other offer is in stock", () => {
    renderBuyBox(product({ offers: [offer(1, 1000, 5, "Loot Lane")] }));

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add to cart/ })).toBeVisible();
  });

  it("shows only Out of stock without a best offer", () => {
    renderBuyBox(product({ best_offer_id: null, price: null }));

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.queryByText(/Sold by/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
