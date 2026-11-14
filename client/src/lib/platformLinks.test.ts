import { describe, expect, it, vi } from "vitest";
import { platformHref } from "./platformLinks";

vi.mock("./env", () => ({
  env: { apiUrl: "https://api.example.test" },
}));

describe("platformHref", () => {
  it("builds the store URL for one platform", () => {
    expect(platformHref("playstation")).toBe("/store?platform=playstation");
  });
});
