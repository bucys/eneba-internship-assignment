import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { catalogFiltersQuery } from "../api/catalog";
import { ApiError } from "../api/client";
import { productsQuery } from "../api/products";
import { Container } from "../components/layout/Container";
import {
  ProductCard,
  ProductCardSkeleton,
} from "../components/product/ProductCard";
import { ProductGrid } from "../components/product/ProductGrid";
import { toProductCardProps } from "../components/product/toProductCardProps";
import { ActiveFilterChips } from "../components/store/ActiveFilterChips";
import { FiltersDialog } from "../components/store/FiltersDialog";
import {
  StoreFilterPanel,
  type FilterOptionsState,
} from "../components/store/StoreFilterPanel";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Pagination } from "../components/ui/Pagination";
import { Select } from "../components/ui/Select";
import { cx } from "../lib/cx";
import {
  activeFilterCount,
  DEFAULT_STORE_PARAMS,
  resultCountLabel,
  sortOptions,
  storeErrorMessage,
  storeHref,
  type StoreSort,
} from "../lib/storeParams";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useSlowPending } from "../lib/useSlowPending";
import { useStoreParams } from "../lib/useStoreParams";

const SKELETON_COUNT = 12;
const DESKTOP_QUERY = "(min-width: 1024px)";
const SITE_TITLE = "Eneba Marketplace (demo)";

function scrollToTop() {
  window.scrollTo({ top: 0 });
}

function useFilterOptions(): FilterOptionsState {
  const query = useQuery(catalogFiltersQuery());
  if (query.data) return { status: "ready", options: query.data.data };
  if (query.isError && !query.isFetching) {
    return { status: "error", onRetry: () => void query.refetch() };
  }
  return { status: "loading" };
}

export function StorePage() {
  const { params, apply } = useStoreParams();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const filterOptions = useFilterOptions();
  const products = useQuery(productsQuery(params));
  const data = products.data;
  const isBeyondLast =
    data !== undefined &&
    data.meta.total > 0 &&
    data.meta.current_page > data.meta.last_page;
  const mustClamp = isBeyondLast && !products.isPlaceholderData;
  const lastPage = data?.meta.last_page ?? 1;
  // isFetching (not isPending) so the notice also shows while "Try again" refetches after an error.
  const isSlow = useSlowPending(products.isFetching && !data);

  useEffect(() => {
    if (mustClamp) {
      void navigate(storeHref({ ...params, page: lastPage }), {
        replace: true,
        preventScrollReset: true,
      });
    }
  }, [mustClamp, lastPage, navigate, params]);

  const hasError = products.isError && !products.isFetching;
  const isInvalid =
    hasError &&
    products.error instanceof ApiError &&
    products.error.status === 422;
  const total = data?.meta.total ?? 0;
  const showCount =
    !hasError && data !== undefined && total > 0 && !isBeyondLast;
  const clearFilters = () => apply(() => DEFAULT_STORE_PARAMS);
  const heading = params.q === "" ? "Store" : `Results for "${params.q}"`;

  const panel = (
    <StoreFilterPanel
      params={params}
      options={filterOptions}
      onChange={apply}
    />
  );

  function renderResults() {
    if (isInvalid) {
      return (
        <div role="alert">
          <ErrorState
            title="Some filters in this link are not valid."
            message="Remove the bad filter, or clear them all."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      );
    }

    if (hasError) {
      return (
        <ErrorState
          message={storeErrorMessage(products.error)}
          onRetry={() => void products.refetch()}
        />
      );
    }

    if (!data || isBeyondLast) {
      return (
        <div className="flex flex-col gap-4">
          {isSlow && (
            <Alert role="status">
              Waking up the server. The first visit after a quiet spell can take
              up to a minute.
            </Alert>
          )}
          <ProductGrid>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </ProductGrid>
        </div>
      );
    }

    if (total === 0) {
      return (
        <EmptyState
          title="No products match"
          message="Try removing a filter or searching for something else."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <ProductGrid>
          {data.data.map((product) => (
            <ProductCard key={product.slug} {...toProductCardProps(product)} />
          ))}
        </ProductGrid>
        <Pagination
          page={data.meta.current_page}
          lastPage={data.meta.last_page}
          hrefFor={(page) => storeHref({ ...params, page })}
          label="Store pages"
          onNavigate={scrollToTop}
        />
      </div>
    );
  }

  return (
    <Container className="py-10">
      <title>{`${heading} | ${SITE_TITLE}`}</title>
      <h1 className="text-2xl font-extrabold wrap-anywhere md:text-3xl">
        {heading}
      </h1>

      <div className="mt-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        {isDesktop && <aside aria-label="Filters">{panel}</aside>}

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            {!isDesktop && (
              <FiltersDialog
                activeCount={activeFilterCount(params)}
                total={total}
              >
                {panel}
              </FiltersDialog>
            )}
            <div className="w-full sm:ml-auto sm:w-60">
              <Select
                label="Sort by"
                value={params.sort}
                onChange={(event) =>
                  apply((current) => ({
                    ...current,
                    sort: event.target.value as StoreSort,
                  }))
                }
              >
                {sortOptions(params.q).map((sort) => (
                  <option key={sort.value} value={sort.value}>
                    {sort.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <ActiveFilterChips
            params={params}
            options={
              filterOptions.status === "ready"
                ? filterOptions.options
                : undefined
            }
            onChange={apply}
          />

          <p aria-live="polite" className="min-h-5 text-sm text-fg-soft">
            {showCount ? resultCountLabel(total) : ""}
          </p>

          <div
            aria-busy={products.isPlaceholderData || undefined}
            className={cx(
              "transition-opacity",
              products.isPlaceholderData && "opacity-60",
            )}
          >
            {renderResults()}
          </div>
        </div>
      </div>
    </Container>
  );
}
