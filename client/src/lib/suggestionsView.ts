import type { Suggestion } from "../api/search";

/** What the open dropdown shows (spec 0013 AC-10). */
export type SuggestionsView =
  | { status: "searching" }
  | { status: "unavailable" }
  | { status: "results"; suggestions: Suggestion[]; isStale: boolean };

export const UNAVAILABLE_TEXT = "Suggestions are unavailable right now.";

/** Hidden text for the polite live region; blank while nothing has settled (AC-9). */
export function suggestionsAnnouncement(view: SuggestionsView | null): string {
  if (view === null || view.status === "searching") return "";
  if (view.status === "unavailable") return UNAVAILABLE_TEXT;
  if (view.isStale) return "";
  const count = view.suggestions.length;
  if (count === 0) return "No games match";
  return count === 1 ? "1 suggestion" : `${count} suggestions`;
}
