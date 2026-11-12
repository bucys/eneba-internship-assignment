import { describe, expect, it } from "vitest";
import { PRODUCT_TYPE_LABELS, productQuery } from "./products";

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
