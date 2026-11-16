import type { Ref } from "react";
import { Link } from "react-router";
import { cx } from "../../lib/cx";
import type { Money } from "../../lib/money";
import { Skeleton } from "../ui/Skeleton";
import { COVER_ASPECT_CLASS, CoverImage } from "./CoverImage";
import { Price } from "./Price";
import { QuickAddActions, QuickAddIconButton } from "./ProductQuickAdd";

export type ProductCardLayout = "vertical" | "horizontal";

type ProductCardProps = {
  slug: string;
  name: string;
  coverImageUrl: string | null;
  platformName: string;
  regionName: string;
  price: Money | null;
  listPrice: Money | null;
  discountPercent: number | null;
  layout?: ProductCardLayout;
  ref?: Ref<HTMLAnchorElement>;
};

const layoutClasses: Record<ProductCardLayout, string> = {
  vertical: "flex-col gap-3",
  horizontal: "flex-row items-start gap-3",
};

export function ProductCard({
  slug,
  name,
  coverImageUrl,
  platformName,
  regionName,
  price,
  listPrice,
  discountPercent,
  layout = "vertical",
  ref,
}: ProductCardProps) {
  const canBuy = price !== null;

  return (
    <div
      className={cx(
        "relative flex rounded-sm bg-surface transition-shadow hover:ring-1 hover:ring-accent hover:ring-inset",
        layout === "vertical" && "h-full flex-col",
      )}
    >
      {/* Inset focus outline, so a scrolling rail never clips the ring (spec 0014 AC-13). */}
      <Link
        ref={ref}
        to={`/products/${slug}`}
        className={cx(
          "flex flex-1 rounded-sm p-3 focus-visible:-outline-offset-2 focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset",
          layoutClasses[layout],
        )}
      >
        <div
          className={cx(
            "relative",
            layout === "horizontal" ? "w-20 shrink-0" : "w-full",
          )}
        >
          <CoverImage key={coverImageUrl} url={coverImageUrl} alt={name} />
          <span className="absolute inset-x-0 bottom-0 truncate rounded-b-sm bg-black/70 px-1 py-1 text-center text-xs font-semibold text-fg">
            {platformName}
          </span>
        </div>
        <div
          className={cx(
            "flex flex-1 flex-col",
            layout === "horizontal" ? "min-w-0 gap-2" : "gap-3",
          )}
        >
          <div className="flex flex-1 flex-col gap-1">
            <span className="line-clamp-2 text-sm font-semibold text-fg">
              {name}
            </span>
            <span className="text-xs font-extrabold text-accent uppercase">
              {regionName}
            </span>
          </div>
          {/* Right padding keeps the price clear of the pinned cart button. */}
          <div
            className={cx(
              "flex flex-col gap-0.5",
              canBuy && (layout === "horizontal" ? "pr-12" : "pr-12 md:pr-0"),
            )}
          >
            {canBuy && <span className="text-xs text-fg-muted">From</span>}
            <Price
              price={price}
              listPrice={listPrice}
              discountPercent={discountPercent}
            />
          </div>
        </div>
      </Link>
      {canBuy && layout === "horizontal" && (
        <QuickAddIconButton slug={slug} name={name} />
      )}
      {canBuy && layout === "vertical" && (
        <>
          <QuickAddIconButton slug={slug} name={name} className="md:hidden" />
          <QuickAddActions slug={slug} name={name} className="hidden md:flex" />
        </>
      )}
    </div>
  );
}

type ProductCardSkeletonProps = { layout?: ProductCardLayout };

export function ProductCardSkeleton({
  layout = "vertical",
}: ProductCardSkeletonProps) {
  if (layout === "horizontal") {
    return (
      <div
        aria-hidden="true"
        className="flex flex-row items-start gap-3 rounded-sm bg-surface p-3"
      >
        <Skeleton className={`${COVER_ASPECT_CLASS} w-20 shrink-0`} />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/4" />
          <Skeleton className="h-6 w-1/3" />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col gap-3 rounded-sm bg-surface p-3"
    >
      <Skeleton className={`${COVER_ASPECT_CLASS} w-full`} />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="mt-2 h-3 w-1/4" />
      <Skeleton className="h-6 w-1/3" />
    </div>
  );
}
