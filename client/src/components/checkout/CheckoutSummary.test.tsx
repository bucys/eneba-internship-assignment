// @vitest-environment jsdom
import "../../test/dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cart, cartLine } from "../../test/fixtures";
import { CheckoutSummary } from "./CheckoutSummary";

describe("CheckoutSummary", () => {
  it("lists one row per line with its seller, platform, region, and line total", () => {
    render(
      <CheckoutSummary
        cart={cart([
          cartLine(),
          cartLine({
            offer_id: 2,
            quantity: 2,
            line_total: { amount: 3998, currency: "EUR" },
            seller: { name: "GameVault" },
          }),
        ])}
      />,
    );

    const rows = within(
      screen.getByRole("list", { name: "Items" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent("Sold by GameVault");
    expect(rows[1]).toHaveTextContent("Steam · Global");
    expect(rows[1]).toHaveTextContent("2 × €19.99");
    expect(rows[1]).toHaveTextContent("€39.98");
  });

  it("shows the server total", () => {
    render(
      <CheckoutSummary
        cart={cart([cartLine()], { total: { amount: 12345, currency: "EUR" } })}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Order summary" }),
    ).toHaveTextContent("€123.45");
  });

  // covers: AC-11
  it.each([
    [1, "1 item"],
    [3, "3 items"],
  ])("says %i as %j from item_count", (count, text) => {
    render(
      <CheckoutSummary cart={cart([cartLine()], { item_count: count })} />,
    );

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  // covers: AC-11
  it("explains a quantity the server lowered to the stock", () => {
    render(
      <CheckoutSummary
        cart={cart([cartLine({ quantity: 3, quantity_reduced: true })])}
      />,
    );

    expect(
      screen.getByText("Only 3 available, so we lowered the quantity."),
    ).toBeInTheDocument();
  });

  it("says nothing about stock when the quantity was not lowered", () => {
    render(<CheckoutSummary cart={cart([cartLine()])} />);

    expect(
      screen.queryByText(/available, so we lowered/),
    ).not.toBeInTheDocument();
  });
});
