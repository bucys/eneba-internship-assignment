import { describe, expect, it } from "vitest";
import { loginPath, safeRedirect } from "./safeRedirect";

const ORIGIN = "https://eneba.example.com";

describe("safeRedirect", () => {
  // covers: AC-9
  it.each([
    ["/orders", "/orders"],
    ["/orders?x=1", "/orders?x=1"],
    ["/orders?x=1#top", "/orders?x=1"],
    ["/", "/"],
  ])("keeps the same origin path %j", (value, expected) => {
    expect(safeRedirect(value, ORIGIN)).toBe(expected);
  });

  // covers: AC-9
  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/%0a/evil.com",
    "/%2F/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "orders",
    "/login",
    "/login?redirectTo=%2Forders",
    "/register",
    "/register/",
    "/%E0%A4%A",
    "",
    null,
    undefined,
  ])("falls back to / for %j", (value) => {
    expect(safeRedirect(value, ORIGIN)).toBe("/");
  });
});

describe("loginPath", () => {
  // covers: AC-9, AC-13
  it("encodes path plus search and adds the expired reason on request", () => {
    expect(loginPath("/orders?x=1")).toBe(
      "/login?redirectTo=%2Forders%3Fx%3D1",
    );
    expect(loginPath("/orders", { expired: true })).toBe(
      "/login?redirectTo=%2Forders&reason=expired",
    );
  });
});
