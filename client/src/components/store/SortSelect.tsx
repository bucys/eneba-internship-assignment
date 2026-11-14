import { ArrowDownWideNarrow, Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "../../lib/cx";
import {
  STORE_SORTS,
  sortOptions,
  type StoreSort,
} from "../../lib/storeParams";

type SortSelectProps = {
  value: StoreSort;
  query: string;
  onChange: (sort: StoreSort) => void;
};

/**
 * Eneba style sort picker: a select only combobox (WAI-ARIA APG pattern). Focus stays on the
 * trigger while the list is open; aria-activedescendant points at the highlighted option.
 */
export function SortSelect({ value, query, onChange }: SortSelectProps) {
  const options = sortOptions(query);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const valueId = `${baseId}-value`;
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const selectedLabel =
    STORE_SORTS.find((option) => option.value === value)?.label ?? "";

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function openAt(index: number) {
    setActiveIndex(index);
    setOpen(true);
  }

  function choose(index: number) {
    setOpen(false);
    const next = options[index].value;
    if (next !== value) onChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;

    if (!open) {
      const startAt: Partial<Record<string, number>> = {
        ArrowDown: selectedIndex,
        ArrowUp: selectedIndex,
        Enter: selectedIndex,
        " ": selectedIndex,
        Home: 0,
        End: last,
      };
      const index = startAt[event.key];
      if (index !== undefined) {
        event.preventDefault();
        openAt(index);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <span id={labelId} className="sr-only">
        Sort by
      </span>
      <button
        type="button"
        role="combobox"
        aria-labelledby={`${labelId} ${valueId}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={handleKeyDown}
        className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-extrabold whitespace-nowrap text-cta transition-colors hover:text-cta-hover"
      >
        <ArrowDownWideNarrow aria-hidden="true" className="size-5 shrink-0" />
        <span id={valueId}>{selectedLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className={cx(
            "size-4 shrink-0 motion-safe:transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <ul
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        hidden={!open}
        // Keeps focus on the trigger when an option is clicked.
        onMouseDown={(event) => event.preventDefault()}
        className="absolute top-full right-0 z-30 mt-1 w-max min-w-48 rounded-sm bg-white py-1 shadow-lg"
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={selected}
              onClick={() => choose(index)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cx(
                "flex min-h-10 cursor-pointer items-center justify-between gap-4 px-3 text-sm text-surface-deep",
                index === activeIndex && "bg-fg-soft",
                selected && "font-extrabold text-bg",
              )}
            >
              {option.label}
              {selected && (
                <Check aria-hidden="true" className="size-4 shrink-0" />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
