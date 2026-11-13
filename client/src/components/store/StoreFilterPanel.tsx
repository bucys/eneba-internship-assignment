import type { CatalogFilters, FilterOption } from "../../api/catalog";
import type { StoreParamsUpdate } from "../../lib/useStoreParams";
import type { StoreParams } from "../../lib/storeParams";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Skeleton } from "../ui/Skeleton";
import { PriceRangeFields } from "./PriceRangeFields";

export type FilterOptionsState =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; options: CatalogFilters };

type StoreFilterPanelProps = {
  params: StoreParams;
  options: FilterOptionsState;
  onChange: (update: StoreParamsUpdate) => void;
};

const legendClasses = "mb-2 text-sm font-extrabold text-fg";

/** Adds a ticked slug at the end, so the URL keeps the order the visitor ticked them. */
function toggle(list: string[], slug: string, checked: boolean): string[] {
  return checked
    ? [...list.filter((item) => item !== slug), slug]
    : list.filter((item) => item !== slug);
}

function OptionGroup({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (slug: string, checked: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className={legendClasses}>{legend}</legend>
      {options.map((option) => (
        <Checkbox
          key={option.slug}
          label={option.name}
          checked={selected.includes(option.slug)}
          onChange={(event) => onToggle(option.slug, event.target.checked)}
        />
      ))}
    </fieldset>
  );
}

function OptionGroupSkeleton({ legend }: { legend: string }) {
  return (
    <fieldset aria-busy="true">
      <legend className={legendClasses}>{legend}</legend>
      <div className="flex flex-col gap-3 py-1">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-3/4" />
        ))}
      </div>
    </fieldset>
  );
}

/** Platform, Region, and Price groups (spec 0012 AC-6). Every change applies at once. */
export function StoreFilterPanel({
  params,
  options,
  onChange,
}: StoreFilterPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {options.status === "ready" && (
        <>
          <OptionGroup
            legend="Platform"
            options={options.options.platforms}
            selected={params.platform}
            onToggle={(slug, checked) =>
              onChange((current) => ({
                ...current,
                platform: toggle(current.platform, slug, checked),
              }))
            }
          />
          <OptionGroup
            legend="Region"
            options={options.options.regions}
            selected={params.region}
            onToggle={(slug, checked) =>
              onChange((current) => ({
                ...current,
                region: toggle(current.region, slug, checked),
              }))
            }
          />
        </>
      )}
      {options.status === "loading" && (
        <>
          <OptionGroupSkeleton legend="Platform" />
          <OptionGroupSkeleton legend="Region" />
        </>
      )}
      {options.status === "error" && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-fg-soft">Filters could not load.</p>
          <Button variant="secondary" onClick={options.onRetry}>
            Try again
          </Button>
        </div>
      )}
      <fieldset>
        <legend className={legendClasses}>Price (EUR)</legend>
        <PriceRangeFields
          min={params.priceMin}
          max={params.priceMax}
          onApply={(priceMin, priceMax) =>
            onChange((current) => ({ ...current, priceMin, priceMax }))
          }
        />
      </fieldset>
    </div>
  );
}
