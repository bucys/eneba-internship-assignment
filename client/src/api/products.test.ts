import { describe, expect, it, vi } from "vitest";
import { PRODUCT_TYPE_LABELS, productQuery, productsQuery } from "./products";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

describe("PRODUCT_TYPE_LABELS", () => {
  it("labels every product type", () => {
    expect(PRODUCT_TYPE_LABELS).toEqual({
      game: "Game",
      dlc: "DLC",
      gift_card: "Gift card",
      subscription: "Subscription",
    });
  });
});

describe("productQuery", () => {
  it("keys the detail by slug under products", () => {
    expect(productQuery("the-witcher-3").queryKey).toEqual([
      "products",
      "detail",
      "the-witcher-3",
    ]);
  });
});

describe("productsQuery", () => {
  it("keys the list by the canonical search under products", () => {
    expect(productsQuery({}).queryKey).toEqual(["products", "list", ""]);
    expect(
      productsQuery({ platform: ["steam"], sort: "price_asc" }).queryKey,
    ).toEqual(["products", "list", "?platform=steam&sort=price_asc"]);
  });
});
