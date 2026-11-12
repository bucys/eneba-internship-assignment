import { describe, expect, it } from "vitest";
import { focusAfterRemove } from "./cartFocus";

describe("focusAfterRemove", () => {
  it("waits while the removed line is still shown", () => {
    expect(focusAfterRemove([1, 2, 3], { offerId: 2, index: 1 })).toBeNull();
  });

  it("moves to the row that took the removed row's place", () => {
    expect(focusAfterRemove([1, 3], { offerId: 2, index: 1 })).toBe(1);
  });

  it("moves to the new last row when the last row was removed", () => {
    expect(focusAfterRemove([1, 2], { offerId: 3, index: 2 })).toBe(1);
  });

  it("moves to the heading when the cart is now empty", () => {
    expect(focusAfterRemove([], { offerId: 1, index: 0 })).toBe("heading");
  });
});
