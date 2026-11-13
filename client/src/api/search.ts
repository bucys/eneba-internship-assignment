import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { Money } from "../lib/money";
import { normaliseSearchTerm } from "../lib/searchTerm";
import { apiFetch } from "./client";
import type { NamedRef } from "./products";

// Mirrors server/app/Http/Resources/SearchSuggestionResource.php.
export type Suggestion = {
  slug: string;
  name: string;
  cover_image_url: string;
  platform: NamedRef;
  price: Money | null;
};

export function getSearchSuggestions(term: string, signal?: AbortSignal) {
  return apiFetch<{ data: Suggestion[] }>(
    `/search/suggestions?q=${encodeURIComponent(term)}`,
    { signal },
  );
}

/**
 * Keyed and sent as the normalised term, so a cached answer always matches what was asked.
 * No retry: typing again is the retry (spec 0013 AC-10).
 */
export function searchSuggestionsQuery(term: string) {
  const normalised = normaliseSearchTerm(term);

  return queryOptions({
    queryKey: ["search", "suggestions", normalised],
    queryFn: ({ signal }) => getSearchSuggestions(normalised, signal),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
