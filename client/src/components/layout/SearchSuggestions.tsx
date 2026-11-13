import type { MouseEvent } from "react";
import { cx } from "../../lib/cx";
import { highlightMatches } from "../../lib/searchTerm";
import {
  UNAVAILABLE_TEXT,
  type SuggestionsView,
} from "../../lib/suggestionsView";
import { CoverImage } from "../product/CoverImage";
import { Price } from "../product/Price";

type SearchSuggestionsProps = {
  listboxId: string;
  optionId: (index: number) => string;
  view: SuggestionsView;
  term: string;
  activeIndex: number;
  onSelect: (index: number) => void;
};

function HighlightedName({ name, term }: { name: string; term: string }) {
  return (
    <span className="line-clamp-2 text-sm text-fg">
      {highlightMatches(name, term).map((segment, index) =>
        segment.match ? (
          <mark
            key={index}
            className="bg-transparent font-extrabold text-current"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </span>
  );
}

function optionClasses(isActive: boolean) {
  return cx(
    "flex min-h-11 cursor-pointer items-center gap-3 border-l-4 px-3 py-2 transition-colors hover:bg-surface-deep",
    isActive ? "border-cta bg-surface-deep" : "border-transparent",
  );
}

function StatusRow({ children }: { children: string }) {
  return <p className="px-4 py-3 text-sm text-fg-muted">{children}</p>;
}

/**
 * The dropdown under the header search. Focus never leaves the input: mousedown is
 * prevented so a click does not blur it, and selection happens on click (AC-9).
 */
export function SearchSuggestions({
  listboxId,
  optionId,
  view,
  term,
  activeIndex,
  onSelect,
}: SearchSuggestionsProps) {
  const suggestions = view.status === "results" ? view.suggestions : [];
  const isStale = view.status === "results" && view.isStale;
  const trimmed = term.trim();
  const keepFocus = (event: MouseEvent) => event.preventDefault();

  return (
    <div
      onMouseDown={keepFocus}
      className="absolute inset-x-0 top-full z-20 mt-1 max-h-[min(24rem,60dvh)] overflow-y-auto rounded-sm border border-surface-deep bg-surface shadow-lg"
    >
      {view.status === "searching" && <StatusRow>Searching…</StatusRow>}
      {view.status === "unavailable" && (
        <StatusRow>{UNAVAILABLE_TEXT}</StatusRow>
      )}
      {view.status === "results" && suggestions.length === 0 && (
        <StatusRow>{`No games match "${trimmed}"`}</StatusRow>
      )}
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Search suggestions"
        aria-busy={isStale || undefined}
        className={cx("transition-opacity", isStale && "opacity-60")}
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.slug}
            id={optionId(index)}
            role="option"
            aria-selected={index === activeIndex}
            onClick={() => onSelect(index)}
            className={optionClasses(index === activeIndex)}
          >
            <div className="w-10 shrink-0">
              <CoverImage url={suggestion.cover_image_url} alt="" />
            </div>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <HighlightedName name={suggestion.name} term={term} />
              <span className="text-xs text-fg-muted">
                {suggestion.platform.name}
              </span>
            </span>
            <span className="shrink-0">
              <Price price={suggestion.price} />
            </span>
          </li>
        ))}
        {suggestions.length > 0 && (
          <li
            id={optionId(suggestions.length)}
            role="option"
            aria-selected={activeIndex === suggestions.length}
            onClick={() => onSelect(suggestions.length)}
            className={cx(
              optionClasses(activeIndex === suggestions.length),
              "border-t border-t-surface-deep text-sm font-semibold text-fg",
            )}
          >
            {`See all results for "${trimmed}"`}
          </li>
        )}
      </ul>
    </div>
  );
}
