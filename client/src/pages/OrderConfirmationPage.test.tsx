// @vitest-environment jsdom
import "../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, order, orderItem } from "../test/fixtures";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const { queryClient } = await import("../lib/queryClient");
const { orderQueryKey } = await import("../api/orders");
const { OrderConfirmationPage } = await import("./OrderConfirmationPage");

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn(async () => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderOrderPage(ulid: string) {
  const router = createMemoryRouter(
    [{ path: "/orders/:ulid", Component: OrderConfirmationPage }],
    { initialEntries: [`/orders/${ulid}`] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe("OrderConfirmationPage", () => {
  // covers: AC-15
  it("shows the paid order with its uppercase ULID, items, total, and a way back to the store", async () => {
    const paid = order({
      items: [
        orderItem(),
        orderItem({
          id: 2,
          product: { slug: "hades", cover_image_url: "" },
          product_name: "Hades",
          quantity: 1,
          line_total: { amount: 1999, currency: "EUR" },
        }),
      ],
      total: { amount: 5997, currency: "EUR" },
    });
    queryClient.setQueryData(orderQueryKey(paid.ulid), paid);
    stubFetch(() => jsonResponse(200, { data: paid }));

    renderOrderPage(paid.ulid);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Payment successful",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(paid.ulid.toUpperCase())).toBeInTheDocument();
    expect(document.title).toBe("Order confirmed | Eneba Marketplace (demo)");

    // Direct rows only; each row also holds a nested list of key slots.
    const rows = Array.from(
      screen.getByRole("list", { name: "Order items" }).children,
    ) as HTMLElement[];
    expect(rows).toHaveLength(2);
    expect(
      within(rows[1]).getByRole("link", { name: "Hades" }),
    ).toHaveAttribute("href", "/products/hades");
    expect(rows[0]).toHaveTextContent("2 × €19.99");
    expect(rows[0]).toHaveTextContent("Sold by KeyHub");

    expect(screen.getByText("€59.97")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue shopping" }),
    ).toHaveAttribute("href", "/");
  });

  // covers: AC-15
  it("marks the paid time with the machine readable UTC value", async () => {
    const paid = order();
    stubFetch(() => jsonResponse(200, { data: paid }));

    renderOrderPage(paid.ulid);

    await screen.findByText(paid.ulid.toUpperCase());
    expect(document.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-11-13T10:24:51Z",
    );
  });

  // covers: AC-9, AC-15
  it("loads the order from the API on a reload", async () => {
    const paid = order();
    const fetchMock = stubFetch(() => jsonResponse(200, { data: paid }));

    renderOrderPage(paid.ulid);

    expect(
      await screen.findByText(paid.ulid.toUpperCase()),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/api/v1/orders/${paid.ulid}`,
      expect.anything(),
    );
  });

  // covers: AC-9
  it("shows Order not found with a link to the store for an unknown ULID", async () => {
    stubFetch(() => jsonResponse(404, { message: "Not found." }));

    renderOrderPage("01junknown0000000000000000");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Order not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to the store" }),
    ).toHaveAttribute("href", "/");
    expect(document.title).toBe("Order not found | Eneba Marketplace (demo)");
  });

  it("shows an error state with Try again when the order fails to load", async () => {
    stubFetch(() => jsonResponse(403, { message: "Forbidden." }));

    renderOrderPage("01jcheckoutorder0000000000");

    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
