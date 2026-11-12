import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "eneba.auth_token";

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
  return import("./authToken");
}

function storageEvent(key: string | null) {
  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: key });
  return event;
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authToken", () => {
  // covers: AC-8, AC-11
  it("reads the stored token on load", async () => {
    storage.setItem(KEY, "stored");
    stubWindow(storage);
    const { authToken } = await loadModule();

    expect(authToken.get()).toBe("stored");
  });

  // covers: AC-8, AC-12
  it("writes set and clear to memory and storage and notifies subscribers", async () => {
    stubWindow(storage);
    const { authToken } = await loadModule();
    const listener = vi.fn();
    const unsubscribe = authToken.subscribe(listener);

    authToken.set("abc");
    expect(authToken.getSnapshot()).toBe("abc");
    expect(storage.getItem(KEY)).toBe("abc");

    authToken.clear();
    expect(authToken.get()).toBeNull();
    expect(storage.getItem(KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    authToken.set("later");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps working in memory when storage is blocked", async () => {
    stubWindow(new BlockedStorage());
    const { authToken } = await loadModule();

    expect(authToken.get()).toBeNull();
    authToken.set("memory-only");
    expect(authToken.get()).toBe("memory-only");
    authToken.clear();
    expect(authToken.get()).toBeNull();
  });
});

describe("startTokenStorageSync", () => {
  // covers: AC-14
  it("adopts another tab's token without writing back, then notifies", async () => {
    const win = stubWindow(storage);
    const { authToken, startTokenStorageSync } = await loadModule();
    const order: string[] = [];
    const onChange = vi.fn(() => order.push("onChange"));
    authToken.subscribe(() => order.push("notify"));
    const setItem = vi.spyOn(storage, "setItem");
    const removeItem = vi.spyOn(storage, "removeItem");
    const stop = startTokenStorageSync(onChange);

    storage.values.set(KEY, "from-other-tab");
    win.dispatchEvent(storageEvent(KEY));
    expect(authToken.get()).toBe("from-other-tab");
    expect(onChange).toHaveBeenLastCalledWith("from-other-tab");

    storage.values.delete(KEY);
    win.dispatchEvent(storageEvent(KEY));
    expect(authToken.get()).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(null);

    expect(order).toEqual(["onChange", "notify", "onChange", "notify"]);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();

    stop();
  });

  it("ignores other keys and events that change nothing", async () => {
    const win = stubWindow(storage);
    const { startTokenStorageSync } = await loadModule();
    const onChange = vi.fn();
    startTokenStorageSync(onChange);

    win.dispatchEvent(storageEvent("something.else"));
    win.dispatchEvent(storageEvent(KEY));

    expect(onChange).not.toHaveBeenCalled();
  });
});
