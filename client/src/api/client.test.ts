import { afterEach, describe, expect, it, vi } from "vitest";
import { API_TIMEOUT_MS, ApiError, apiFetch } from "./client";

vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(implementation: typeof fetch) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function catchError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiFetch", () => {
  // covers: AC-9
  it("calls the versioned API with Accept: application/json", async () => {
    const fetchMock = stubFetch(async () => jsonResponse(200, { data: [] }));

    await expect(apiFetch("/products")).resolves.toEqual({ data: [] });

    const [url, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(url).toBe("https://api.example.test/api/v1/products");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.has("Content-Type")).toBe(false);
  });

  // covers: AC-9
  it("adds Content-Type only when it sends a body", async () => {
    const fetchMock = stubFetch(async () => jsonResponse(201, { data: {} }));

    await apiFetch("/cart", { method: "POST", body: "{}" });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  // covers: AC-9
  it("turns a Laravel validation error into ApiError with field errors", async () => {
    stubFetch(async () =>
      jsonResponse(422, {
        message: "The email field is required.",
        errors: { email: ["The email field is required."] },
      }),
    );

    const error = await catchError(apiFetch("/login"));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: "http",
      status: 422,
      message: "The email field is required.",
      errors: { email: ["The email field is required."] },
    });
  });

  // covers: AC-9
  it("falls back to a generic message when the error body is not JSON", async () => {
    stubFetch(
      async () => new Response("<html>Bad Gateway</html>", { status: 502 }),
    );

    const error = await catchError(apiFetch("/products"));

    expect(error).toMatchObject({
      kind: "http",
      status: 502,
      message: "Something went wrong. Please try again.",
      errors: undefined,
    });
  });

  // covers: AC-8
  it("reports a rejected fetch as a network error", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const error = await catchError(apiFetch("/products"));

    expect(error).toMatchObject({ kind: "network", status: 0 });
  });

  // covers: AC-8
  it("aborts after 90 s and reports a timeout", async () => {
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutController.signal);
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    const pending = catchError(apiFetch("/products"));
    timeoutController.abort(new DOMException("timed out", "TimeoutError"));
    const error = await pending;

    expect(timeoutSpy).toHaveBeenCalledWith(API_TIMEOUT_MS);
    expect(error).toMatchObject({ kind: "timeout", status: 0 });
  });

  // covers: AC-8
  it("rethrows the caller's own abort untouched", async () => {
    const controller = new AbortController();
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    const pending = catchError(
      apiFetch("/products", { signal: controller.signal }),
    );
    controller.abort();
    const error = await pending;

    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as DOMException).name).toBe("AbortError");
  });
});
