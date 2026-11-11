import { Search } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { cx } from "../../lib/cx";

type SearchFormProps = {
  className?: string;
};

export function SearchForm({ className }: SearchFormProps) {
  const inputId = useId();
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = term.trim();
    if (trimmed === "") return;
    navigate("/store?q=" + encodeURIComponent(trimmed));
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
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search for games, top ups and more"
        className="min-h-11 w-full rounded-sm border border-fg-muted bg-surface py-2 pr-3 pl-10 text-sm text-fg transition-colors placeholder:text-fg-muted hover:border-fg-soft"
      />
    </form>
  );
}
