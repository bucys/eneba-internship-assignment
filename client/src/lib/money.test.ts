import { describe, expect, it } from "vitest";
import { formatPrice } from "./money";

describe("formatPrice", () => {
  it.each([
    [998, "€9.98"],
    [99, "€0.99"],
    [123400, "€1,234.00"],
    [0, "€0.00"],
  ])("formats %i cents as %s", (amount, expected) => {
    expect(formatPrice({ amount, currency: "EUR" })).toBe(expected);
  });
});
