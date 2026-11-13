import { Skeleton } from "../ui/Skeleton";

export function CheckoutPageSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_22rem] md:items-start"
    >
      <Skeleton className="h-64 w-full md:col-start-2 md:row-start-1" />
      <div className="flex flex-col gap-4 md:col-start-1 md:row-start-1">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}
