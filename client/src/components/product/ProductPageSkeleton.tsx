import { Skeleton } from "../ui/Skeleton";
import { COVER_ASPECT_CLASS } from "./CoverImage";

const OFFER_ROW_COUNT = 3;

export function ProductPageSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8">
        <Skeleton
          className={`${COVER_ASPECT_CLASS} w-full max-w-48 md:max-w-none`}
        />
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-36 w-full md:max-w-sm" />
        </div>
      </div>
      <Skeleton className="mt-10 mb-4 h-6 w-32" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: OFFER_ROW_COUNT }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
