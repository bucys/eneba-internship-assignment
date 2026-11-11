import { describe, expect, it } from "vitest";
import type { Product } from "../../api/products";
import { toProductCardProps } from "./toProductCardProps";

const product: Product = {
  slug: "the-witcher-3-wild-hunt-steam-global",
  name: "The Witcher 3: Wild Hunt",
  type: "game",
  cover_image_url: "https://images.example.test/witcher.jpg",
  platform: { slug: "steam", name: "Steam" },
  region: { slug: "global", name: "Global" },
  price: { amount: 1299, currency: "EUR" },
  list_price: { amount: 3999, currency: "EUR" },
  discount_percent: 67,
};

describe("toProductCardProps", () => {
  // covers: AC-7
  it("maps every API field to the card props", () => {
    expect(toProductCardProps(product)).toEqual({
      slug: "the-witcher-3-wild-hunt-steam-global",
      name: "The Witcher 3: Wild Hunt",
      coverImageUrl: "https://images.example.test/witcher.jpg",
      platformName: "Steam",
      regionName: "Global",
      price: { amount: 1299, currency: "EUR" },
      listPrice: { amount: 3999, currency: "EUR" },
      discountPercent: 67,
    });
  });

  // covers: AC-7
  it("keeps null price, list price and discount", () => {
    const props = toProductCardProps({
      ...product,
      price: null,
      list_price: null,
      discount_percent: null,
    });

    expect(props).toMatchObject({
      price: null,
      listPrice: null,
      discountPercent: null,
    });
  });
});
