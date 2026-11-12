import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { ApiError } from "../api/client";
import { productQuery } from "../api/products";
import { Container } from "../components/layout/Container";
import { OfferList } from "../components/product/OfferList";
import { ProductAbout } from "../components/product/ProductAbout";
import { ProductHero } from "../components/product/ProductHero";
import { ProductPageSkeleton } from "../components/product/ProductPageSkeleton";
import { Alert } from "../components/ui/Alert";
import { LinkButton } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { useSlowPending } from "../lib/useSlowPending";

const SITE_TITLE = "Eneba Marketplace (demo)";

function isNotFound(error: unknown) {
  return (
    error instanceof ApiError && error.kind === "http" && error.status === 404
  );
}

function ProductNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-6">
      <title>{`Game not found | ${SITE_TITLE}`}</title>
      <h1 className="text-2xl font-extrabold md:text-3xl">Game not found</h1>
      <p className="text-fg-soft">
        This game does not exist or is no longer sold.
      </p>
      <LinkButton to="/" className="mt-2">
        Go to homepage
      </LinkButton>
    </div>
  );
}

function ProductPageBody({ slug }: { slug: string }) {
  const query = useQuery(productQuery(slug));
  // isFetching (not isPending) so the notice also shows while "Try again" refetches after an error.
  const isSlow = useSlowPending(query.isFetching && !query.data);

  if (query.isError && !query.isFetching) {
    if (isNotFound(query.error)) {
      return <ProductNotFound />;
    }
    return (
      <>
        <h1 className="sr-only">Game details</h1>
        <ErrorState onRetry={() => void query.refetch()} />
      </>
    );
  }

  if (!query.data) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="sr-only">Loading game details</h1>
        {isSlow && (
          <Alert role="status">
            Waking up the server. The first visit after a quiet spell can take
            up to a minute.
          </Alert>
        )}
        <ProductPageSkeleton />
      </div>
    );
  }

  const product = query.data.data;

  return (
    <>
      <title>{`${product.name} | ${SITE_TITLE}`}</title>
      <ProductHero
        product={product}
        heading={
          <h1 className="text-2xl font-extrabold break-words md:text-3xl">
            {product.name}
          </h1>
        }
      />
      <OfferList offers={product.offers} bestOfferId={product.best_offer_id} />
      <ProductAbout product={product} />
    </>
  );
}

export function ProductPage() {
  const { slug = "" } = useParams();

  return (
    <Container className="py-10">
      {/* A new key per slug resets the slow notice timer between games. */}
      <ProductPageBody key={slug} slug={slug} />
    </Container>
  );
}
