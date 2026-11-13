import { describe, expect, it, vi } from "vitest";
vi.mock("../lib/env", () => ({ env: { apiUrl: "https://api.example.test" } }));

import { ApiError } from "../api/client";
import {
  isOrderNotFound,
  ORDER_CONFIRMED_TITLE,
  ORDER_NOT_FOUND_TITLE,
} from "./orderPageView";

describe("order page titles", () => {
  it("uses the spec 0009 AC-15 titles", () => {
    expect(ORDER_CONFIRMED_TITLE).toBe(
      "Order confirmed | Eneba Marketplace (demo)",
    );
    expect(ORDER_NOT_FOUND_TITLE).toBe(
      "Order not found | Eneba Marketplace (demo)",
    );
  });
});

describe("isOrderNotFound", () => {
  it("is true only for a 404", () => {
    expect(
      isOrderNotFound(
        new ApiError({ kind: "http", status: 404, message: "Not found" }),
      ),
    ).toBe(true);
    expect(
      isOrderNotFound(
        new ApiError({ kind: "http", status: 500, message: "Boom" }),
      ),
    ).toBe(false);
    expect(
      isOrderNotFound(
        new ApiError({ kind: "network", status: 0, message: "Offline" }),
      ),
    ).toBe(false);
    expect(isOrderNotFound(null)).toBe(false);
  });
});
