import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

const { cartMergeNotice } = await import("./cartMergeNotice");

afterEach(() => {
  cartMergeNotice.take();
});

// covers: spec 0016 AC-12 (the merge toast waits as a flag until the layout takes it)
describe("cartMergeNotice", () => {
  it("has nothing to take before any raise", () => {
    expect(cartMergeNotice.take()).toBe(false);
  });

  it("gives true once per raise, then false", () => {
    cartMergeNotice.raise();

    expect(cartMergeNotice.take()).toBe(true);
    expect(cartMergeNotice.take()).toBe(false);
  });

  it("keeps one pending notice for two raises in a row", () => {
    cartMergeNotice.raise();
    cartMergeNotice.raise();

    expect(cartMergeNotice.take()).toBe(true);
    expect(cartMergeNotice.take()).toBe(false);
  });

  it("tells subscribers on raise and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = cartMergeNotice.subscribe(listener);

    cartMergeNotice.raise();
    unsubscribe();
    cartMergeNotice.raise();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
