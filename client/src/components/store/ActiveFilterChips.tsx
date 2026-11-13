import { X } from "lucide-react";
import type { CatalogFilters, FilterOption } from "../../api/catalog";
import {
  DEFAULT_STORE_PARAMS,
  hasClearableFilters,
  priceChipLabel,
  type StoreParams,
} from "../../lib/storeParams";
import { Button } from "../ui/Button";

type ActiveFilterChipsProps = {
  params: StoreParams;
  /** Option names; while missing, chips show the slug. */
  options?: CatalogFilters;
  onChange: (next: StoreParams) => void;
};

type Chip = { key: string; label: string; next: StoreParams };

function nameFor(options: FilterOption[] | undefined, slug: string): string {
  return options?.find((option) => option.slug === slug)?.name ?? slug;
}

function buildChips(params: StoreParams, options?: CatalogFilters): Chip[] {
  const chips: Chip[] = [
    ...params.platform.map((slug) => ({
      key: `platform-${slug}`,
      label: nameFor(options?.platforms, slug),
      next: { ...params, platform: params.platform.filter((s) => s !== slug) },
    })),
    ...params.region.map((slug) => ({
      key: `region-${slug}`,
      label: nameFor(options?.regions, slug),
      next: { ...params, region: params.region.filter((s) => s !== slug) },
    })),
  ];

  const priceLabel = priceChipLabel(params.priceMin, params.priceMax);
  if (priceLabel !== null) {
    chips.push({
      key: "price",
      label: priceLabel,
      next: { ...params, priceMin: null, priceMax: null },
    });
  }

  if (params.q !== "") {
    chips.push({
      key: "q",
      label: `Search: ${params.q}`,
      next: { ...params, q: "" },
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
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label="Active filters" className="contents">
        {chips.map((chip) => (
          <li key={chip.key} className="max-w-full">
            <button
              type="button"
              aria-label={`Remove filter: ${chip.label}`}
              onClick={() => onChange(chip.next)}
              className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-sm border border-fg-muted bg-surface px-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-deep"
            >
              <span className="truncate">{chip.label}</span>
              <X aria-hidden="true" className="size-4 shrink-0 text-fg-soft" />
            </button>
          </li>
        ))}
      </ul>
      {canClear && (
        <Button
          variant="ghost"
          onClick={() => onChange({ ...DEFAULT_STORE_PARAMS, q: params.q })}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
