import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { productsQuery } from "../../api/products";
import { useSlowPending } from "../../lib/useSlowPending";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { ProductGrid } from "./ProductGrid";
import { toProductCardProps } from "./toProductCardProps";

const SKELETON_COUNT = 12;

function ProductListBody() {
  const query = useQuery(productsQuery({}));
  // isFetching (not isPending) so the notice also shows while "Try again" refetches after an error.
  const isSlow = useSlowPending(query.isFetching && !query.data);

  const notice = isSlow && (
    <Alert role="status">
      Waking up the server. The first visit after a quiet spell can take up to a
      minute.
    </Alert>
  );

  if (query.isError && !query.isFetching) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  if (!query.data) {
    return (
      <div className="flex flex-col gap-4">
        {notice}
        <ProductGrid>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </ProductGrid>
      </div>
    );
  }

  if (query.data.data.length === 0) {
    return <EmptyState title="No games yet" message="Check back soon." />;
  }

  return (
    <ProductGrid>
      {query.data.data.map((product) => (
        <ProductCard key={product.slug} {...toProductCardProps(product)} />
      ))}
    </ProductGrid>
  );
}

export function ProductListSection() {
  return (
    <section aria-labelledby="browse-games-heading" className="mt-8">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 id="browse-games-heading" className="text-xl font-extrabold">
          Browse games
        </h2>
        <Link
          to="/store"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-link hover:underline"
        >
          See all
        </Link>
      </div>
      <ProductListBody />
    </section>
  );
}
