import { X } from "lucide-react";
import type { StoreParamsUpdate } from "../../lib/useStoreParams";
import type { CatalogFilters, FilterOption } from "../../api/catalog";
import {
  DEFAULT_STORE_PARAMS,
  defaultSort,
  hasClearableFilters,
  priceChipLabel,
  type StoreParams,
} from "../../lib/storeParams";
import { Button } from "../ui/Button";

type ActiveFilterChipsProps = {
  params: StoreParams;
  /** Option names; while missing, chips show the slug. */
  options?: CatalogFilters;
  onChange: (update: StoreParamsUpdate) => void;
};

type Chip = {
  key: string;
  label: string;
  remove: (current: StoreParams) => StoreParams;
};

function nameFor(options: FilterOption[] | undefined, slug: string): string {
  return options?.find((option) => option.slug === slug)?.name ?? slug;
}

function buildChips(params: StoreParams, options?: CatalogFilters): Chip[] {
  const chips: Chip[] = [
    ...params.platform.map((slug) => ({
      key: `platform-${slug}`,
      label: nameFor(options?.platforms, slug),
      remove: (current: StoreParams) => ({
        ...current,
        platform: current.platform.filter((s) => s !== slug),
      }),
    })),
    ...params.region.map((slug) => ({
      key: `region-${slug}`,
      label: nameFor(options?.regions, slug),
      remove: (current: StoreParams) => ({
        ...current,
        region: current.region.filter((s) => s !== slug),
      }),
    })),
  ];

  const priceLabel = priceChipLabel(params.priceMin, params.priceMax);
  if (priceLabel !== null) {
    chips.push({
      key: "price",
      label: priceLabel,
      remove: (current) => ({ ...current, priceMin: null, priceMax: null }),
    });
  }

  if (params.q !== "") {
    chips.push({
      key: "q",
      label: `Search: ${params.q}`,
      remove: (current) => ({ ...current, q: "" }),
    });
  }

  return chips;
}

/** One removable chip per active filter, plus Clear all, which keeps the search (spec 0012 AC-7). */
export function ActiveFilterChips({
  params,
  options,
  onChange,
}: ActiveFilterChipsProps) {
  const chips = buildChips(params, options);
  const canClear = hasClearableFilters(params);

  if (chips.length === 0 && !canClear) return null;

  return (
    // Below lg the chips scroll in one row, with Clear all kept outside the scroller; from lg they wrap.
    <div className="flex min-w-0 items-center gap-2 lg:flex-wrap">
      {chips.length > 0 && (
        // The padding gives focus outlines room inside the scroller, which clips its overflow.
        <ul
          aria-label="Active filters"
          className="-m-1 flex min-w-0 flex-1 gap-2 overflow-x-auto p-1 lg:contents"
        >
          {chips.map((chip) => (
            <li key={chip.key} className="max-w-64 shrink-0 lg:max-w-full">
              <button
                type="button"
                aria-label={`Remove filter: ${chip.label}`}
                onClick={() => onChange(chip.remove)}
                className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-sm border border-fg-muted bg-surface px-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-deep"
              >
                <span className="truncate">{chip.label}</span>
                <X
                  aria-hidden="true"
                  className="size-4 shrink-0 text-fg-soft"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {canClear && (
        <Button
          variant="ghost"
          className="shrink-0"
          onClick={() =>
            onChange((current) => ({
              ...DEFAULT_STORE_PARAMS,
              q: current.q,
              sort: defaultSort(current.q),
            }))
          }
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
