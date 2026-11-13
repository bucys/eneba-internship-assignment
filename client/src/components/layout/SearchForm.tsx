import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  useId,
  useState,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { searchSuggestionsQuery } from "../../api/search";
import { cx } from "../../lib/cx";
import { MIN_SUGGEST_LENGTH, normaliseSearchTerm } from "../../lib/searchTerm";
import {
  DEFAULT_STORE_PARAMS,
  defaultSort,
  parseStoreParams,
  STORE_PATH,
  storeHref,
} from "../../lib/storeParams";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import {
  suggestionsAnnouncement,
  type SuggestionsView,
} from "../../lib/suggestionsView";
import { SearchSuggestions } from "./SearchSuggestions";

type SearchFormProps = {
  className?: string;
};

/** Same cap as the server's `q` rule, so the form never sends a 422 (spec 0012 AC-10). */
const MAX_TERM_LENGTH = 100;

const SUGGEST_DEBOUNCE_MS = 250;

const NO_ACTIVE_OPTION = -1;

function canSuggest(term: string) {
  return term.trim().length >= MIN_SUGGEST_LENGTH;
}

export function SearchForm({ className }: SearchFormProps) {
  const inputId = useId();
  const listboxId = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const urlQ =
    location.pathname === STORE_PATH
      ? parseStoreParams(new URLSearchParams(location.search)).q
      : null;
  const [term, setTerm] = useState(urlQ ?? "");
  const [syncedQ, setSyncedQ] = useState(urlQ);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(NO_ACTIVE_OPTION);
  const [hasShownSinceOpen, setHasShownSinceOpen] = useState(false);
  const [locationKey, setLocationKey] = useState(location.key);

  // On /store the field follows the URL's q (submit, back, forward, the chip); elsewhere it keeps its text.
  // This sync never opens the dropdown: only the visitor's own input does (spec 0013 AC-7).
  if (urlQ !== null && urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    setTerm(urlQ);
  }

  const debouncedTerm = useDebouncedValue(term, SUGGEST_DEBOUNCE_MS);
  const suggestions = useQuery({
    ...searchSuggestionsQuery(debouncedTerm),
    enabled: isOpen && canSuggest(term) && canSuggest(debouncedTerm),
  });
  const isCurrentTerm =
    normaliseSearchTerm(term) === normaliseSearchTerm(debouncedTerm);
  const hasCurrentAnswer =
    isCurrentTerm && suggestions.isSuccess && !suggestions.isPlaceholderData;

  function close() {
    setIsOpen(false);
    setActiveIndex(NO_ACTIVE_OPTION);
    setHasShownSinceOpen(false);
  }

  // Any route change closes the dropdown (AC-7).
  if (location.key !== locationKey) {
    setLocationKey(location.key);
    close();
  }

  // Closing clears what the dropdown showed, so a reopen never flashes an older term's list.
  if (isOpen && hasCurrentAnswer && !hasShownSinceOpen) {
    setHasShownSinceOpen(true);
  }

  let view: SuggestionsView | null = null;
  if (isOpen) {
    if (isCurrentTerm && suggestions.isError) {
      view = { status: "unavailable" };
    } else if (suggestions.data && (hasCurrentAnswer || hasShownSinceOpen)) {
      view = {
        status: "results",
        suggestions: suggestions.data.data,
        isStale: !hasCurrentAnswer,
      };
    } else {
      view = { status: "searching" };
    }
  }

  const results = view?.status === "results" ? view.suggestions : [];
  // The suggestions plus the "See all" row, which shows only when there are suggestions.
  const optionCount = results.length > 0 ? results.length + 1 : 0;
  const active = activeIndex < optionCount ? activeIndex : NO_ACTIVE_OPTION;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  function goToStore() {
    const q = term.trim();
    // A fresh search: every other store param is dropped.
    const target = storeHref({
      ...DEFAULT_STORE_PARAMS,
      q,
      sort: defaultSort(q),
    });
    close();
    if (target === location.pathname + location.search) return;
    void navigate(target);
  }

  function select(index: number) {
    if (index === results.length) {
      goToStore();
      return;
    }
    close();
    void navigate(`/products/${results[index].slug}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToStore();
  }

  function handleChange(value: string) {
    setTerm(value);
    setActiveIndex(NO_ACTIVE_OPTION);
    if (canSuggest(value)) {
      setIsOpen(true);
    } else {
      close();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) {
          if (canSuggest(term)) setIsOpen(true);
        } else if (optionCount > 0) {
          setActiveIndex((active + 1) % optionCount);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (isOpen && optionCount > 0) {
          setActiveIndex(active <= 0 ? optionCount - 1 : active - 1);
        }
        break;
      case "Enter":
        if (isOpen && active !== NO_ACTIVE_OPTION) {
          event.preventDefault();
          select(active);
        }
        break;
      case "Escape":
        event.preventDefault();
        if (isOpen) {
          close();
        } else {
          setTerm("");
        }
        break;
      case "Tab":
        close();
        break;
    }
  }

  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      onBlur={handleBlur}
      className={cx("relative", className)}
    >
      <label htmlFor={inputId} className="sr-only">
        Search
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-fg-muted"
      />
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={view === null ? undefined : listboxId}
        aria-activedescendant={
          active === NO_ACTIVE_OPTION ? undefined : optionId(active)
        }
        autoComplete="off"
        value={term}
        maxLength={MAX_TERM_LENGTH}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => {
          if (canSuggest(term)) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search for games, top ups and more"
        className="min-h-11 w-full rounded-sm border border-fg-muted bg-surface py-2 pr-3 pl-10 text-sm text-fg transition-colors placeholder:text-fg-muted hover:border-fg-soft"
      />
      {view !== null && (
        <SearchSuggestions
          listboxId={listboxId}
          optionId={optionId}
          view={view}
          term={term}
          activeIndex={active}
          onSelect={select}
        />
      )}
      <p aria-live="polite" className="sr-only">
        {suggestionsAnnouncement(view)}
      </p>
    </form>
  );
}
