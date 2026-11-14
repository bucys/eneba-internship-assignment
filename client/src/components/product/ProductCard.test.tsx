// @vitest-environment jsdom
import "../../test/dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ProductCard } from "./ProductCard";

function renderCard() {
  return render(
    <MemoryRouter>
      <ProductCard
        slug="hades"
        name="Hades"
        coverImageUrl={null}
        platformName="Steam"
        regionName="Europe"
        price={{ amount: 999, currency: "EUR" }}
        listPrice={null}
        discountPercent={null}
      />
    </MemoryRouter>,
  );
}

describe("ProductCard", () => {
  it("is one link to the product whose name contains the product name", () => {
    renderCard();

    const link = screen.getByRole("link", { name: /Hades/ });
    expect(link).toHaveAttribute("href", "/products/hades");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("uppercases the region with CSS, keeping the DOM text", () => {
    renderCard();

    const region = screen.getByText("Europe");
    expect(region).toHaveClass("uppercase");
    expect(screen.getByText("Steam")).toBeInTheDocument();
  });
});
