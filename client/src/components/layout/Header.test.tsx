// @vitest-environment jsdom
import "../../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

const { queryClient } = await import("../../lib/queryClient");
const { Header } = await import("./Header");

function renderHeader(url: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Header cartCount={1} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Header", () => {
  it("has no second navigation row", () => {
    renderHeader("/");

    expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Steam" })).toBeNull();
  });

  it("links to the store, not current off the store", () => {
    renderHeader("/");

    const store = screen.getByRole("link", { name: "Store" });
    expect(store).toHaveAttribute("href", "/store");
    expect(store).not.toHaveAttribute("aria-current");
  });

  it.each(["/store", "/store?q=x", "/store?platform=steam"])(
    "marks Store current on %s",
    (url) => {
      renderHeader(url);

      expect(screen.getByRole("link", { name: "Store" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    },
  );

  it("keeps the cart name", () => {
    renderHeader("/");

    expect(screen.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();
  });
});
