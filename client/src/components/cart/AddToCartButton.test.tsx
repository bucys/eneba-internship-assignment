// @vitest-environment jsdom
import "../../test/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cart, cartLine, jsonResponse } from "../../test/fixtures";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

const { authToken } = await import("../../lib/authToken");
const { guestCart } = await import("../../lib/guestCart");
const { queryClient } = await import("../../lib/queryClient");
const { ToastProvider } = await import("../ui/Toast");
const { AddToCartButton } = await import("./AddToCartButton");

function stubFetch(response: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
}

async function clickAdd(stock = 5) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ToastProvider>
          <AddToCartButton offerId={7} stock={stock} />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));
}

beforeEach(() => {
  authToken.set("token-a");
});

afterEach(() => {
  authToken.clear();
  guestCart.clear();
  queryClient.clear();
  vi.unstubAllGlobals();
});

// covers: spec 0016 AC-12
describe("AddToCartButton toasts", () => {
  it("says Added to cart for an add with no adjustments", async () => {
    stubFetch(() =>
      jsonResponse(200, {
        data: cart([cartLine({ offer_id: 7 })]),
        meta: { adjustments: [] },
      }),
    );

    await clickAdd();

    expect(await screen.findByText("Added to cart.")).toBeInTheDocument();
  });

  it("still adds when an older API answers without meta", async () => {
    stubFetch(() =>
      jsonResponse(200, { data: cart([cartLine({ offer_id: 7 })]) }),
    );

    await clickAdd();

    expect(await screen.findByText("Added to cart.")).toBeInTheDocument();
  });

  it("says how many were added when the server capped the add", async () => {
    stubFetch(() =>
      jsonResponse(200, {
        data: cart([cartLine({ offer_id: 7, quantity: 6 })]),
        meta: { adjustments: [{ offer_id: 7, requested: 10, added: 6 }] },
      }),
    );

    await clickAdd();

    expect(
      await screen.findByText("Only 6 available, so we added 6."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Added to cart.")).not.toBeInTheDocument();
  });

  it("shows the server's reason when nothing can be added", async () => {
    stubFetch(() =>
      jsonResponse(422, {
        message: "You already have the maximum for this offer.",
        errors: { quantity: ["You already have the maximum for this offer."] },
      }),
    );

    await clickAdd();

    expect(
      await screen.findByText("You already have the maximum for this offer."),
    ).toBeInTheDocument();
  });

  it("keeps the plain toast for a guest add, which caps locally", async () => {
    authToken.clear();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await clickAdd();

    expect(await screen.findByText("Added to cart.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(guestCart.get()).toEqual([{ offer_id: 7, quantity: 1 }]);
  });
});
