import { Search } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { cx } from "../../lib/cx";
import {
  DEFAULT_STORE_PARAMS,
  parseStoreParams,
  STORE_PATH,
  storeHref,
} from "../../lib/storeParams";

type SearchFormProps = {
  className?: string;
};

/** Same cap as the server's `q` rule, so the form never sends a 422 (spec 0012 AC-10). */
const MAX_TERM_LENGTH = 100;

export function SearchForm({ className }: SearchFormProps) {
  const inputId = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const urlQ =
    location.pathname === STORE_PATH
      ? parseStoreParams(new URLSearchParams(location.search)).q
      : null;
  const [term, setTerm] = useState(urlQ ?? "");
  const [syncedQ, setSyncedQ] = useState(urlQ);

  // On /store the field follows the URL's q (submit, back, forward, the chip); elsewhere it keeps its text.
  if (urlQ !== null && urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    setTerm(urlQ);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A fresh search: every other store param is dropped.
    const target = storeHref({ ...DEFAULT_STORE_PARAMS, q: term.trim() });
    if (target === location.pathname + location.search) return;
    void navigate(target);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
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
        value={term}
        maxLength={MAX_TERM_LENGTH}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search for games, top ups and more"
        className="min-h-11 w-full rounded-sm border border-fg-muted bg-surface py-2 pr-3 pl-10 text-sm text-fg transition-colors placeholder:text-fg-muted hover:border-fg-soft"
      />
    </form>
  );
}
