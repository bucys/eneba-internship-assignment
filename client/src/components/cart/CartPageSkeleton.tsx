import { Skeleton } from "../ui/Skeleton";

const LINE_COUNT = 2;

export function CartPageSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start"
    >
      <div className="flex flex-col gap-2">
        {Array.from({ length: LINE_COUNT }, (_, index) => (
          <Skeleton key={index} className="h-36 w-full" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
