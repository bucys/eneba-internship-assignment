// @vitest-environment jsdom
import "../../test/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatPrice } from "../../lib/money";
import { Price } from "./Price";

const price = { amount: 1599, currency: "EUR" } as const;
const listPrice = { amount: 2999, currency: "EUR" } as const;

describe("Price", () => {
  it("shows the struck list price and saving above the current price when discounted", () => {
    const { container } = render(
      <Price price={price} listPrice={listPrice} discountPercent={47} />,
    );

    const struck = container.querySelector("s");
    expect(struck).toHaveTextContent(`was ${formatPrice(listPrice)}`);
    expect(screen.getByText("-47%")).toBeInTheDocument();

    const lines = container.firstElementChild?.children;
    expect(lines).toHaveLength(2);
    expect(lines?.[0]).toContainElement(struck);
    expect(lines?.[1]).toHaveTextContent(formatPrice(price));
  });

  it("shows only the price without a discount", () => {
    const { container } = render(
      <Price price={price} listPrice={listPrice} discountPercent={0} />,
    );

    expect(container.querySelector("s")).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(container).toHaveTextContent(formatPrice(price));
  });

  it("shows Out of stock for a null price", () => {
    render(<Price price={null} />);

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });
});
