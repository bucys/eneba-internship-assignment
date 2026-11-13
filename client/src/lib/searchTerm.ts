/** Suggestions need this many characters after trimming (spec 0013 AC-7). */
export const MIN_SUGGEST_LENGTH = 2;

/** Trimmed, lowercased, inner whitespace collapsed: equal terms share one cache entry. */
export function normaliseSearchTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

export type HighlightSegment = { text: string; match: boolean };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every [start, end) range where a word occurs, overlapping ones included. */
function matchRanges(name: string, word: string): [number, number][] {
  const pattern = new RegExp(escapeRegExp(word), "giu");
  const ranges: [number, number][] = [];
  let found = pattern.exec(name);
  while (found !== null) {
    ranges.push([found.index, found.index + found[0].length]);
    pattern.lastIndex = found.index + 1;
    found = pattern.exec(name);
  }
  return ranges;
}

/**
 * Splits a name into plain and matched parts for each typed word of 2+ characters (AC-8).
 * Overlapping or touching matches merge into one. Words that matched only by similarity on
 * the server do not occur in the name, so they get no highlight.
 */
export function highlightMatches(
  name: string,
  term: string,
): HighlightSegment[] {
  const words = term
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= MIN_SUGGEST_LENGTH);
  const ranges = words
    .flatMap((word) => matchRanges(name, word))
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged.at(-1);
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor)
      segments.push({ text: name.slice(cursor, start), match: false });
    segments.push({ text: name.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < name.length)
    segments.push({ text: name.slice(cursor), match: false });
  return segments;
}
