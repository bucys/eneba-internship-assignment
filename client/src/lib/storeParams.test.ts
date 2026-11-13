import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import {
  activeFilterCount,
  canonicalStoreSearch,
  DEFAULT_STORE_PARAMS,
  hasClearableFilters,
  isSameSearch,
  parsePrice,
  parseStoreParams,
  priceChipLabel,
  resultCountLabel,
  storeErrorMessage,
  toStoreSearch,
} from "./storeParams";

vi.mock("./env", () => ({ env: { apiUrl: "https://api.example.test" } }));

const params = (search: string) =>
  parseStoreParams(new URLSearchParams(search));

describe("parseStoreParams", () => {
  it("reads every param", () => {
    expect(
      params(
        "q=witcher&platform=steam,xbox&region=europe&price_min=10&price_max=30&sort=price_asc&page=2",
      ),
    ).toEqual({
      q: "witcher",
      platform: ["steam", "xbox"],
      region: ["europe"],
      priceMin: 10,
      priceMax: 30,
      sort: "price_asc",
      page: 2,
    });
  });

  it("falls back to the defaults for missing or invalid values", () => {
    expect(params("")).toEqual(DEFAULT_STORE_PARAMS);
    expect(params("sort=popular&page=0&price_min=007&price_max=9.5")).toEqual(
      DEFAULT_STORE_PARAMS,
    );
    expect(params("page=abc&q=%20%20").page).toBe(1);
  });

  it("drops empty list items and duplicates but keeps the ticked order", () => {
    expect(params("platform=xbox,,steam,xbox").platform).toEqual([
      "xbox",
      "steam",
    ]);
  });

  it("keeps unknown slugs for the server to reject", () => {
    expect(params("platform=sega").platform).toEqual(["sega"]);
  });
});

describe("parsePrice", () => {
  it.each(["0", "5", "10000"])("accepts %s", (raw) => {
    expect(parsePrice(raw)).toBe(Number(raw));
  });

  it.each(["", "007", "+5", "1e3", "5.0", " 5", "-0", "10001", "99999"])(
    "rejects %j",
    (raw) => {
      expect(parsePrice(raw)).toBeNull();
    },
  );
});

describe("toStoreSearch", () => {
  it("is empty for the defaults", () => {
    expect(toStoreSearch(DEFAULT_STORE_PARAMS)).toBe("");
  });

  it("writes params in a fixed order with plain commas", () => {
    expect(
      toStoreSearch({
        page: 3,
        sort: "price_desc",
        priceMax: 30,
        priceMin: 0,
        region: ["europe"],
        platform: ["xbox", "steam"],
        q: "half life",
      }),
    ).toBe(
      "?q=half%20life&platform=xbox,steam&region=europe&price_min=0&price_max=30&sort=price_desc&page=3",
    );
  });
});

describe("canonicalStoreSearch and isSameSearch", () => {
  const isCanonical = (search: string) => {
    const current = new URLSearchParams(search);
    return isSameSearch(
      current,
      new URLSearchParams(canonicalStoreSearch(current)),
    );
  };

  it("drops default values and unknown params", () => {
    expect(canonicalStoreSearch(new URLSearchParams("sort=name&page=1"))).toBe(
      "",
    );
    expect(isCanonical("sort=name&page=1")).toBe(false);
    expect(isCanonical("utm=x")).toBe(false);
  });

  it("orders params the fixed way", () => {
    expect(isCanonical("sort=price_asc&q=x")).toBe(false);
    expect(isCanonical("q=x&sort=price_asc")).toBe(true);
  });

  it("compares decoded values, not raw strings", () => {
    expect(isCanonical("platform=steam%2Cxbox")).toBe(true);
    expect(isCanonical("q=half+life")).toBe(true);
  });
});

describe("activeFilterCount and hasClearableFilters", () => {
  it("counts each list value and one for any price bound", () => {
    expect(
      activeFilterCount(
        params("platform=steam,xbox&region=europe&price_min=1&price_max=2"),
      ),
    ).toBe(4);
    expect(activeFilterCount(params("q=x&sort=price_asc"))).toBe(0);
  });

  it("treats a non default sort as clearable but not q", () => {
    expect(hasClearableFilters(params("sort=price_asc"))).toBe(true);
    expect(hasClearableFilters(params("q=x"))).toBe(false);
    expect(hasClearableFilters(params("price_min=0"))).toBe(true);
  });
});

describe("priceChipLabel", () => {
  it.each([
    [10, 30, "€10 to €30"],
    [10, null, "From €10"],
    [0, null, "From €0"],
    [null, 30, "Up to €30"],
    [10, 10, "€10"],
    [null, null, null],
  ])("labels min %j max %j", (min, max, label) => {
    expect(priceChipLabel(min, max)).toBe(label);
  });
});

describe("resultCountLabel", () => {
  it("uses the singular for one", () => {
    expect(resultCountLabel(1)).toBe("1 result");
    expect(resultCountLabel(24)).toBe("24 results");
  });
});

describe("storeErrorMessage", () => {
  it("names the wait on a 429", () => {
    const error = new ApiError({
      kind: "http",
      status: 429,
      message: "Too Many Attempts.",
      retryAfter: 30,
    });
    expect(storeErrorMessage(error)).toMatch(/30 seconds/);
  });

  it("passes other API messages and ignores non API errors", () => {
    const error = new ApiError({
      kind: "network",
      status: 0,
      message: "Offline",
    });
    expect(storeErrorMessage(error)).toBe("Offline");
    expect(storeErrorMessage(new Error("x"))).toBeUndefined();
  });
});
