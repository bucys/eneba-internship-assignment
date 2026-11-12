import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cart, CartLine } from "../api/cart";

const KEY = "eneba.guestCart";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

class BlockedStorage {
  getItem(): string | null {
    throw new Error("SecurityError");
  }
  setItem() {
    throw new Error("SecurityError");
  }
  removeItem() {
    throw new Error("SecurityError");
  }
}

function stubWindow(storage: MemoryStorage | BlockedStorage) {
  const target = new EventTarget();
  vi.stubGlobal("window", Object.assign(target, { localStorage: storage }));
  return target;
}

async function loadModule() {
  vi.resetModules();
  return import("./guestCart");
}

function stored(storage: MemoryStorage) {
  const raw = storage.getItem(KEY);
  return raw === null ? null : JSON.parse(raw);
}

function previewLine(
  offerId: number,
  overrides: Partial<CartLine> = {},
): CartLine {
  return {
    offer_id: offerId,
    quantity: 1,
    max_quantity: 10,
    available: true,
    quantity_reduced: false,
    unit_price: { amount: 100, currency: "EUR" },
    line_total: { amount: 100, currency: "EUR" },
    seller: { name: "Seller" },
    product: {
      slug: "game",
      name: "Game",
      cover_image_url: "",
      platform: { slug: "pc", name: "PC" },
      region: { slug: "global", name: "Global" },
    },
    ...overrides,
  };
}

function previewCart(lines: CartLine[]): Cart {
  return {
    lines,
    item_count: 0,
    total: { amount: 0, currency: "EUR" },
    can_checkout: true,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseGuestCart", () => {
  it("reads bad JSON, an unknown version, or a missing value as empty", async () => {
    stubWindow(new MemoryStorage());
    const { parseGuestCart } = await loadModule();

    expect(parseGuestCart(null)).toEqual([]);
    expect(parseGuestCart("{not json")).toEqual([]);
    expect(parseGuestCart('{"version":2,"lines":[]}')).toEqual([]);
    expect(parseGuestCart('{"version":1,"lines":"x"}')).toEqual([]);
    expect(parseGuestCart("null")).toEqual([]);
  });

  it("drops invalid and repeated lines and keeps the rest in order", async () => {
    stubWindow(new MemoryStorage());
    const { parseGuestCart } = await loadModule();

    const raw = JSON.stringify({
      version: 1,
      lines: [
        { offer_id: 5, quantity: 2 },
        { offer_id: 0, quantity: 1 },
        { offer_id: 6, quantity: 11 },
        { offer_id: 7, quantity: 1.5 },
        { offer_id: "8", quantity: 1 },
        null,
        { offer_id: 5, quantity: 9 },
        { offer_id: 9, quantity: 10 },
      ],
    });

    expect(parseGuestCart(raw)).toEqual([
      { offer_id: 5, quantity: 2 },
      { offer_id: 9, quantity: 10 },
    ]);
  });
});

describe("guestCart", () => {
  it("loads stored lines and survives a reload", async () => {
    const storage = new MemoryStorage();
    stubWindow(storage);
    const first = await loadModule();
    first.guestCart.add(12, 5);
    first.guestCart.add(12, 5);

    const second = await loadModule();
    expect(second.guestCart.get()).toEqual([{ offer_id: 12, quantity: 2 }]);
    expect(stored(storage)).toEqual({
      version: 1,
      lines: [{ offer_id: 12, quantity: 2 }],
    });
  });

  it("caps adds at min(stock, 10) with the server's message", async () => {
    stubWindow(new MemoryStorage());
    const { guestCart, GuestCartError } = await loadModule();

    guestCart.add(1, 2);
    guestCart.add(1, 2);
    expect(() => guestCart.add(1, 2)).toThrow(
      new GuestCartError(
        "quantity",
        "You already have the maximum for this offer.",
      ),
    );
    expect(guestCart.get()).toEqual([{ offer_id: 1, quantity: 2 }]);

    for (let i = 0; i < 10; i++) guestCart.add(2, 40);
    expect(() => guestCart.add(2, 40)).toThrow("You already have the maximum");
    expect(() => guestCart.add(3, 0)).toThrow("This offer is out of stock.");
  });

  it("refuses a 51st line", async () => {
    stubWindow(new MemoryStorage());
    const { guestCart } = await loadModule();

    for (let id = 1; id <= 50; id++) guestCart.add(id, 5);

    expect(() => guestCart.add(51, 5)).toThrow("Your cart is full.");
    expect(guestCart.get()).toHaveLength(50);
    guestCart.add(1, 5);
    expect(guestCart.get()[0]).toEqual({ offer_id: 1, quantity: 2 });
  });

  it("sets quantity within 1 and the cap, and removes lines", async () => {
    const storage = new MemoryStorage();
    stubWindow(storage);
    const { guestCart } = await loadModule();
    guestCart.add(1, 5);

    guestCart.setQuantity(1, 9, 3);
    expect(guestCart.get()).toEqual([{ offer_id: 1, quantity: 3 }]);
    guestCart.setQuantity(1, 0, 3);
    expect(guestCart.get()).toEqual([{ offer_id: 1, quantity: 1 }]);

    guestCart.remove(1);
    expect(guestCart.get()).toEqual([]);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("keeps the cart in memory when storage is blocked", async () => {
    stubWindow(new BlockedStorage());
    const { guestCart } = await loadModule();

    guestCart.add(1, 5);

    expect(guestCart.get()).toEqual([{ offer_id: 1, quantity: 1 }]);
  });

  it("adopts changes from another tab", async () => {
    const storage = new MemoryStorage();
    const target = stubWindow(storage);
    const { guestCart, startGuestCartStorageSync } = await loadModule();
    const stop = startGuestCartStorageSync();
    const listener = vi.fn();
    guestCart.subscribe(listener);

    storage.setItem(
      KEY,
      JSON.stringify({ version: 1, lines: [{ offer_id: 4, quantity: 3 }] }),
    );
    target.dispatchEvent(Object.assign(new Event("storage"), { key: KEY }));

    expect(guestCart.get()).toEqual([{ offer_id: 4, quantity: 3 }]);
    expect(listener).toHaveBeenCalledOnce();
    stop();
  });

  it("adopts a storage clear from another tab without writing back", async () => {
    const storage = new MemoryStorage();
    const target = stubWindow(storage);
    const { guestCart, startGuestCartStorageSync } = await loadModule();
    guestCart.add(1, 5);
    const stop = startGuestCartStorageSync();
    const setItem = vi.spyOn(storage, "setItem");

    storage.removeItem(KEY);
    target.dispatchEvent(Object.assign(new Event("storage"), { key: null }));

    expect(guestCart.get()).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
    stop();
  });

  it("ignores other keys and stops listening after stop()", async () => {
    const storage = new MemoryStorage();
    const target = stubWindow(storage);
    const { guestCart, startGuestCartStorageSync } = await loadModule();
    const stop = startGuestCartStorageSync();
    const listener = vi.fn();
    guestCart.subscribe(listener);
    storage.setItem(
      KEY,
      JSON.stringify({ version: 1, lines: [{ offer_id: 4, quantity: 3 }] }),
    );

    target.dispatchEvent(
      Object.assign(new Event("storage"), { key: "something.else" }),
    );
    stop();
    target.dispatchEvent(Object.assign(new Event("storage"), { key: KEY }));

    expect(guestCart.get()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  describe("reconcileWithPreview", () => {
    it("drops missing offers and writes back reduced quantities", async () => {
      const storage = new MemoryStorage();
      stubWindow(storage);
      const { guestCart } = await loadModule();
      guestCart.replace([
        { offer_id: 1, quantity: 5 },
        { offer_id: 2, quantity: 1 },
        { offer_id: 3, quantity: 4 },
      ]);
      const sent = guestCart.get();

      guestCart.reconcileWithPreview(
        sent,
        previewCart([
          previewLine(1, { quantity: 3, quantity_reduced: true }),
          previewLine(3, { available: false, quantity: 4 }),
        ]),
      );

      expect(guestCart.get()).toEqual([
        { offer_id: 1, quantity: 3 },
        { offer_id: 3, quantity: 4 },
      ]);
      expect(stored(storage).lines).toEqual(guestCart.get());
    });

    it("skips the write back when the stored lines changed after the request", async () => {
      stubWindow(new MemoryStorage());
      const { guestCart } = await loadModule();
      guestCart.replace([{ offer_id: 1, quantity: 5 }]);
      const sent = guestCart.get();
      guestCart.add(2, 5);

      guestCart.reconcileWithPreview(sent, previewCart([]));

      expect(guestCart.get()).toEqual([
        { offer_id: 1, quantity: 5 },
        { offer_id: 2, quantity: 1 },
      ]);
    });

    it("writes nothing when nothing differs", async () => {
      stubWindow(new MemoryStorage());
      const { guestCart } = await loadModule();
      guestCart.replace([{ offer_id: 1, quantity: 2 }]);
      const sent = guestCart.get();
      const listener = vi.fn();
      guestCart.subscribe(listener);

      guestCart.reconcileWithPreview(
        sent,
        previewCart([previewLine(1, { quantity: 2 })]),
      );

      expect(listener).not.toHaveBeenCalled();
      expect(guestCart.get()).toBe(sent);
    });
  });
});
