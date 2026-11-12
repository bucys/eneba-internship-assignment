import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCount, formatRating, formatReleaseDate } from "./format";

describe("formatRating", () => {
  it.each([
    [9850, "98.5%"],
    [10000, "100%"],
    [9000, "90%"],
    [0, "0%"],
    [9876, "98.8%"],
  ])("formats %i basis points as %s", (basisPoints, expected) => {
    expect(formatRating(basisPoints)).toBe(expected);
  });
});

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(1204)).toBe("1,204");
    expect(formatCount(7)).toBe("7");
  });
});

describe("formatReleaseDate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["2015-05-18", "18 May 2015"],
    ["2020-01-01", "1 Jan 2020"],
    ["1999-12-31", "31 Dec 1999"],
  ])("formats %s as %s", (isoDate, expected) => {
    expect(formatReleaseDate(isoDate)).toBe(expected);
  });

  it("keeps the same day whatever the local time zone", () => {
    vi.stubEnv("TZ", "Pacific/Honolulu");
    expect(formatReleaseDate("2015-05-18")).toBe("18 May 2015");
  });
});
