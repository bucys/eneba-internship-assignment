import { describe, expect, it } from "vitest";
import { highlightMatches, normaliseSearchTerm } from "./searchTerm";

const marked = (name: string, term: string) =>
  highlightMatches(name, term)
    .map((segment) => (segment.match ? `[${segment.text}]` : segment.text))
    .join("");

// covers: spec 0013 AC-7
describe("normaliseSearchTerm", () => {
  it("trims, lowercases, and collapses inner whitespace", () => {
    expect(normaliseSearchTerm("  Wild \t  HUNT ")).toBe("wild hunt");
  });
});

// covers: spec 0013 AC-8
describe("highlightMatches", () => {
  it("marks every word ignoring case, keeping the name's own case", () => {
    expect(marked("The Witcher 3: Wild Hunt", "wild WITCH")).toBe(
      "The [Witch]er 3: [Wild] Hunt",
    );
  });

  it("marks repeated occurrences", () => {
    expect(marked("Star Stars", "star")).toBe("[Star] [Star]s");
  });

  it("merges overlapping and touching matches", () => {
    expect(marked("Witcher", "witc cher")).toBe("[Witcher]");
    expect(marked("Witcher", "wit cher")).toBe("[Witcher]");
  });

  it("ignores words under two characters", () => {
    expect(marked("A Plague Tale", "a")).toBe("A Plague Tale");
  });

  it("treats regex characters in the term literally", () => {
    expect(marked("Half-Life (2)", "(2) .*")).toBe("Half-Life [(2)]");
    expect(marked("Hundred % Off", "%")).toBe("Hundred % Off");
  });

  it("returns one plain segment when nothing occurs, as for a similarity only match", () => {
    expect(highlightMatches("The Witcher 3", "witchr")).toEqual([
      { text: "The Witcher 3", match: false },
    ]);
  });
});
