import { describe, expect, it } from "vitest";
import { platformHref } from "./platformLinks";

describe("platformHref", () => {
  it("builds the store URL for one platform", () => {
    expect(platformHref("playstation")).toBe("/store?platform=playstation");
  });
});
