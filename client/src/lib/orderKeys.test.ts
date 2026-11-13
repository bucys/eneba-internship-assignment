import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const { ApiError } = await import("../api/client");
const { copyHint, keysErrorMessage, keySlotId } = await import("./orderKeys");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("keysErrorMessage", () => {
  // covers: spec 0010 AC-7
  it("shows the Retry-After seconds on a 429", () => {
    const error = new ApiError({
      kind: "http",
      status: 429,
      message: "Too Many Attempts.",
      retryAfter: 17,
    });
    expect(keysErrorMessage(error)).toBe(
      "Too many requests. Try again in 17 seconds.",
    );
  });

  it.each([
    ["404", new ApiError({ kind: "http", status: 404, message: "Not found." })],
    ["500", new ApiError({ kind: "http", status: 500, message: "Server" })],
    ["network", new ApiError({ kind: "network", status: 0, message: "x" })],
    ["timeout", new ApiError({ kind: "timeout", status: 0, message: "x" })],
    ["unknown", new Error("boom")],
  ])("says the key could not load for %s", (_, error) => {
    expect(keysErrorMessage(error)).toBe("Could not load your key.");
  });
});

describe("copyHint", () => {
  function stubDevice(coarse: boolean, userAgent: string) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: coarse && query === "(pointer: coarse)",
    }));
    vi.stubGlobal("navigator", { userAgent });
  }

  // covers: spec 0010 AC-9
  it("points touch devices to their own copy option", () => {
    stubDevice(true, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");
    expect(copyHint()).toBe("Key selected. Use your device's copy option.");
  });

  it("points non Apple touch devices to their own copy option too", () => {
    stubDevice(true, "Mozilla/5.0 (Linux; Android 15; Pixel 9)");
    expect(copyHint()).toBe("Key selected. Use your device's copy option.");
  });

  it("says Cmd+C on Apple devices with a keyboard", () => {
    stubDevice(false, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    expect(copyHint()).toBe("Key selected. Press Cmd+C to copy.");
  });

  it("says Ctrl+C everywhere else", () => {
    stubDevice(false, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    expect(copyHint()).toBe("Key selected. Press Ctrl+C to copy.");
  });
});

describe("keySlotId", () => {
  it("joins the item id and the slot index", () => {
    expect(keySlotId(7, 2)).toBe("7:2");
  });
});
