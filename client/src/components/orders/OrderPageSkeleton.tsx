import { Skeleton } from "../ui/Skeleton";

export function OrderPageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <Skeleton className="h-5 w-64 max-w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-8 w-40" />
    </div>
  );
}
