import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "../../api/client";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { HomeBlockError } from "./HomeBlockError";

type HomeQueryBlockProps<T> = {
  title: string;
  query: UseQueryResult<T[]>;
  skeleton: ReactNode;
  children: (items: T[]) => ReactNode;
};

type RenderItemsProps<T> = {
  items: T[];
  render: (items: T[]) => ReactNode;
};

// Calls the render prop inside the boundary, so a throw while mapping the data is caught too.
function RenderItems<T>({ items, render }: RenderItemsProps<T>) {
  return render(items);
}

/** One homepage block's states: skeleton, error with Try again, nothing when empty (spec 0014 AC-9). */
export function HomeQueryBlock<T>({
  title,
  query,
  skeleton,
  children,
}: HomeQueryBlockProps<T>) {
  const retry = () => void query.refetch();

  if (query.isError && !query.isFetching) {
    const message =
      query.error instanceof ApiError ? query.error.message : undefined;
    return <HomeBlockError title={title} message={message} onRetry={retry} />;
  }

  if (!query.data) {
    return skeleton;
  }

  if (query.data.length === 0) {
    return null;
  }

  // Keyed on dataUpdatedAt: new data clears a caught error, and the same bad data
  // after Try again lands back on the fallback instead of looping.
  return (
    <ErrorBoundary
      key={query.dataUpdatedAt}
      fallback={() => <HomeBlockError title={title} onRetry={retry} />}
    >
      <RenderItems items={query.data} render={children} />
    </ErrorBoundary>
  );
}
