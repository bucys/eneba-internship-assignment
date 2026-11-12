import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { getProductPageView, productPageTitle } from "./productPageView";

const notFound = new ApiError({
  kind: "http",
  status: 404,
  message: "Not found",
});
const serverError = new ApiError({
  kind: "http",
  status: 500,
  message: "Boom",
});
const networkError = new ApiError({
  kind: "network",
  status: 0,
  message: "Offline",
});
const timeoutError = new ApiError({
  kind: "timeout",
  status: 0,
  message: "Timed out",
});

const base = { hasData: false, isError: false, isFetching: false, error: null };

describe("getProductPageView", () => {
  it("shows loading on the first fetch", () => {
    expect(getProductPageView({ ...base, isFetching: true })).toBe("loading");
  });

  it("shows ready once data exists", () => {
    expect(getProductPageView({ ...base, hasData: true })).toBe("ready");
  });

  it.each([
    ["a 500", serverError],
    ["a network failure", networkError],
    ["a timeout", timeoutError],
  ])("keeps loaded data when a background refetch hits %s", (_, error) => {
    expect(
      getProductPageView({ ...base, hasData: true, isError: true, error }),
    ).toBe("ready");
  });

  it("shows not found when a background refetch returns 404", () => {
    expect(
      getProductPageView({
        ...base,
        hasData: true,
        isError: true,
        error: notFound,
      }),
    ).toBe("not-found");
  });

  it("keeps loaded data while a refetch after a 404 is in flight", () => {
    expect(
      getProductPageView({
        ...base,
        hasData: true,
        isError: true,
        isFetching: true,
        error: notFound,
      }),
    ).toBe("ready");
  });

  it("shows not found for a 404 with no data", () => {
    expect(
      getProductPageView({ ...base, isError: true, error: notFound }),
    ).toBe("not-found");
  });

  it("shows the error state for other errors with no data", () => {
    expect(
      getProductPageView({ ...base, isError: true, error: serverError }),
    ).toBe("error");
  });

  it("shows loading while Try again refetches after an error", () => {
    expect(
      getProductPageView({
        ...base,
        isError: true,
        isFetching: true,
        error: serverError,
      }),
    ).toBe("loading");
  });
});

describe("productPageTitle", () => {
  it.each([
    ["ready", "Hades", "Hades | Eneba Marketplace (demo)"],
    ["not-found", undefined, "Game not found | Eneba Marketplace (demo)"],
    ["loading", undefined, "Loading game | Eneba Marketplace (demo)"],
    ["error", undefined, "Could not load game | Eneba Marketplace (demo)"],
  ] as const)("titles the %s view", (view, name, expected) => {
    expect(productPageTitle(view, name)).toBe(expected);
  });
});
