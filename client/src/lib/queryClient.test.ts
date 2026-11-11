import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { queryClient, shouldRetryQuery } from "./queryClient";

vi.mock("./env", () => ({ env: { apiUrl: "https://api.example.test" } }));

function httpError(status: number) {
  return new ApiError({ kind: "http", status, message: "x" });
}

describe("shouldRetryQuery", () => {
  // covers: AC-8
  it("retries once for network errors and 5xx", () => {
    const network = new ApiError({ kind: "network", status: 0, message: "x" });

    expect(shouldRetryQuery(0, network)).toBe(true);
    expect(shouldRetryQuery(0, httpError(503))).toBe(true);
    expect(shouldRetryQuery(1, network)).toBe(false);
    expect(shouldRetryQuery(1, httpError(503))).toBe(false);
  });

  // covers: AC-8
  it("never retries a timeout or a 4xx", () => {
    const timeout = new ApiError({ kind: "timeout", status: 0, message: "x" });

    expect(shouldRetryQuery(0, timeout)).toBe(false);
    expect(shouldRetryQuery(0, httpError(404))).toBe(false);
    expect(shouldRetryQuery(0, httpError(429))).toBe(false);
  });

  // covers: AC-8
  it("never retries errors that are not ApiError", () => {
    expect(shouldRetryQuery(0, new Error("bug"))).toBe(false);
  });
});

describe("queryClient defaults", () => {
  // covers: AC-8
  it("waits 3 s before a retry and never retries mutations", () => {
    const defaults = queryClient.getDefaultOptions();

    expect(defaults.queries?.retryDelay).toBe(3000);
    expect(defaults.mutations?.retry).toBe(false);
  });
});
