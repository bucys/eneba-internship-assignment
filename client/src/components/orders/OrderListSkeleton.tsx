import { COVER_ASPECT_CLASS } from "../product/CoverImage";
import { cx } from "../../lib/cx";
import { Skeleton } from "../ui/Skeleton";

/** Three stand in rows with the same height as OrderSummaryRow. */
export function OrderListSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex gap-4 rounded-sm bg-surface p-4">
          <Skeleton
            className={cx(COVER_ASPECT_CLASS, "w-14 shrink-0 md:w-16")}
          />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="mt-1 h-6 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
