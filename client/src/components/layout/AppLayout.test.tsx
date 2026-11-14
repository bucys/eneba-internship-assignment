// @vitest-environment jsdom
import "../../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

const { queryClient } = await import("../../lib/queryClient");
const { AppLayout } = await import("./AppLayout");

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        Component: AppLayout,
        children: [
          { index: true, Component: () => <p>Home page</p> },
          {
            path: "cart",
            Component: () => <p>Cart page</p>,
            handle: { checkoutStep: 1 },
          },
          {
            path: "checkout",
            Component: () => <p>Checkout page</p>,
            handle: { requiresAuth: true, checkoutStep: 2 },
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  queryClient.clear();
});

describe("AppLayout header", () => {
  it("shows the shop header with search and the Store link off the checkout flow", async () => {
    renderAt("/");

    await screen.findByText("Home page");
    expect(
      screen.getByRole("combobox", { name: "Search" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: "Store" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Checkout progress" }),
    ).not.toBeInTheDocument();
  });

  it("shows the focused header with step 1 current on the cart", async () => {
    renderAt("/cart");

    await screen.findByText("Cart page");
    expect(screen.queryByRole("combobox", { name: "Search" })).toBeNull();
    expect(
      within(screen.getByRole("banner")).queryByRole("link", { name: "Store" }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /^Cart,/ })).toBeNull();
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent(
      "Cart",
    );
    expect(
      screen.getByRole("link", { name: "Eneba marketplace home" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toBeInTheDocument();
  });

  it("marks only the checkout header, so index.css gives it the one row --header-h", async () => {
    renderAt("/cart");
    await screen.findByText("Cart page");
    expect(screen.getByRole("banner")).toHaveAttribute(
      "data-header",
      "checkout",
    );
  });

  it("leaves the shop header unmarked, so it keeps the two row --header-h on phones", async () => {
    renderAt("/");
    await screen.findByText("Home page");
    expect(screen.getByRole("banner")).not.toHaveAttribute("data-header");
  });

  it("shows step 2 current, with Cart linking back, on checkout", async () => {
    renderAt("/checkout");

    await screen.findByText("Checkout page");
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent(
      "Payment",
    );
    expect(
      screen.getByRole("link", { name: "Cart, completed" }),
    ).toHaveAttribute("href", "/cart");
  });
});
