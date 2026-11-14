import { Skeleton } from "../ui/Skeleton";
import { COVER_ASPECT_CLASS } from "./CoverImage";

const OFFER_ROW_COUNT = 3;

/** Matches the two column product page from lg (spec 0015 AC-15). */
export function ProductPageSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-5 w-48" />
      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex gap-4 md:gap-6">
          <Skeleton className={`${COVER_ASPECT_CLASS} w-28 shrink-0 md:w-44`} />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
        <Skeleton className="h-64 lg:col-start-2 lg:row-span-3 lg:row-start-1" />
        <Skeleton className="h-14 lg:col-start-1" />
        <div className="flex flex-col gap-2 lg:col-start-1">
          <Skeleton className="mb-2 h-6 w-32" />
          {Array.from({ length: OFFER_ROW_COUNT }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
