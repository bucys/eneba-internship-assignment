// @vitest-environment jsdom
import "../../test/dom";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartLineInput, CartWriteResult } from "../../api/cart";
import { cart, cartLine } from "../../test/fixtures";

vi.mock("../../lib/env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

const mergeCart = vi.fn<(items: CartLineInput[]) => Promise<CartWriteResult>>();
vi.mock("../../api/cart", () => ({
  mergeCart: (items: CartLineInput[]) => mergeCart(items),
}));

const { authToken } = await import("../../lib/authToken");
const { guestCart } = await import("../../lib/guestCart");
const { queryClient } = await import("../../lib/queryClient");
const { cartMergeNotice, mergeGuestCartAndNotify } =
  await import("../../lib/cartMergeNotice");
const { ToastProvider } = await import("../ui/Toast");
const { CART_MERGE_MESSAGE, CartMergeToast } = await import("./CartMergeToast");

function renderToast() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <CartMergeToast />
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function mergeWith(adjustments: CartWriteResult["adjustments"]) {
  authToken.set("token-a");
  guestCart.replace([{ offer_id: 1, quantity: 4 }]);
  mergeCart.mockResolvedValue({
    cart: cart([cartLine({ quantity: 2 })]),
    adjustments,
  });
  await mergeGuestCartAndNotify();
}

afterEach(() => {
  mergeCart.mockReset();
  cartMergeNotice.take();
  authToken.clear();
  guestCart.clear();
  queryClient.clear();
});

// covers: spec 0016 AC-12
describe("CartMergeToast", () => {
  it("shows one toast after a merge with adjustments", async () => {
    renderToast();

    await mergeWith([
      { offer_id: 1, requested: 4, added: 2 },
      { offer_id: 2, requested: 1, added: 0 },
    ]);

    expect(await screen.findAllByText(CART_MERGE_MESSAGE)).toHaveLength(1);
  });

  it("shows the toast when the merge finished before the layout mounted", async () => {
    await mergeWith([{ offer_id: 1, requested: 4, added: 2 }]);

    renderToast();

    expect(await screen.findByText(CART_MERGE_MESSAGE)).toBeInTheDocument();
  });

  it("shows nothing after a merge that added every line", async () => {
    renderToast();

    await mergeWith([]);

    expect(screen.queryByText(CART_MERGE_MESSAGE)).not.toBeInTheDocument();
  });

  it("removes the toast when the user signs out or another user signs in", async () => {
    renderToast();
    await mergeWith([{ offer_id: 1, requested: 4, added: 2 }]);
    expect(await screen.findByText(CART_MERGE_MESSAGE)).toBeInTheDocument();

    act(() => authToken.clear());

    expect(screen.queryByText(CART_MERGE_MESSAGE)).not.toBeInTheDocument();

    act(() => authToken.set("token-b"));

    expect(screen.queryByText(CART_MERGE_MESSAGE)).not.toBeInTheDocument();
  });

  it("raises nothing when the user signed out while the merge ran", async () => {
    authToken.set("token-a");
    guestCart.replace([{ offer_id: 1, quantity: 4 }]);
    let respond!: (result: CartWriteResult) => void;
    mergeCart.mockReturnValue(new Promise((resolve) => (respond = resolve)));

    const merging = mergeGuestCartAndNotify();
    authToken.clear();
    respond({
      cart: cart([cartLine({ quantity: 2 })]),
      adjustments: [{ offer_id: 1, requested: 4, added: 2 }],
    });
    await merging;

    expect(cartMergeNotice.take()).toBe(false);
  });
});
