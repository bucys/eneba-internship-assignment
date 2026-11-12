import { afterEach, describe, expect, it, vi } from "vitest";
import { authToken } from "../lib/authToken";
import {
  API_TIMEOUT_MS,
  ApiError,
  apiFetch,
  parseRetryAfter,
  setUnauthorizedHandler,
} from "./client";

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

describe("parseRetryAfter", () => {
  // covers: AC-8
  it.each([
    ["30", 30],
    ["0", 1],
    [" 5 ", 5],
    [null, 60],
    ["soon", 60],
    ["", 60],
    ["1.5", 60],
  ])("parses %j as %i seconds", (header, expected) => {
    expect(parseRetryAfter(header)).toBe(expected);
  });
});

describe("apiFetch auth", () => {
  afterEach(() => {
    authToken.clear();
    setUnauthorizedHandler(null);
  });

  // covers: AC-8
  it("sends the Bearer token when one is stored, and none otherwise", async () => {
    const fetchMock = stubFetch(async () => jsonResponse(200, {}));

    await apiFetch("/auth/me");
    authToken.set("abc");
    await apiFetch("/auth/me");

    const first = new Headers(fetchMock.mock.calls[0][1]?.headers);
    const second = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(first.has("Authorization")).toBe(false);
    expect(second.get("Authorization")).toBe("Bearer abc");
  });

  // covers: AC-8
  it("puts Retry-After seconds on a 429 error", async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ message: "Too Many Attempts." }), {
          status: 429,
          headers: { "Retry-After": "42" },
        }),
    );

    const error = await catchError(apiFetch("/auth/login"));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).retryAfter).toBe(42);
  });

  // covers: AC-13
  it("calls the unauthorized handler with the token it sent on a 401", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stubFetch(async () => jsonResponse(401, { message: "Unauthenticated." }));

    await catchError(apiFetch("/auth/me"));
    expect(handler).not.toHaveBeenCalled();

    authToken.set("sent-token");
    const error = await catchError(apiFetch("/auth/me"));

    expect((error as ApiError).status).toBe(401);
    expect(handler).toHaveBeenCalledExactlyOnceWith({
      token: "sent-token",
      path: "/auth/me",
    });
  });

  // covers: AC-12
  it("keeps a caller's own token and leaves its 401 to the caller", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const fetchMock = stubFetch(async () =>
      jsonResponse(401, { message: "Unauthenticated." }),
    );
    authToken.set("stored-token");

    await catchError(
      apiFetch("/auth/logout", {
        method: "POST",
        headers: { Authorization: "Bearer own-token" },
      }),
    );

    const sent = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(sent.get("Authorization")).toBe("Bearer own-token");
    expect(handler).not.toHaveBeenCalled();
  });
});
