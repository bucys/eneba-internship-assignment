import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { productQuery } from "../api/products";
import { Container } from "../components/layout/Container";
import { BuyBox } from "../components/product/BuyBox";
import { OfferList } from "../components/product/OfferList";
import { ProductAbout } from "../components/product/ProductAbout";
import { ProductBreadcrumb } from "../components/product/ProductBreadcrumb";
import { ProductInfoRows } from "../components/product/ProductInfoRows";
import { ProductPageSkeleton } from "../components/product/ProductPageSkeleton";
import { ProductTitleBlock } from "../components/product/ProductTitleBlock";
import { Alert } from "../components/ui/Alert";
import { LinkButton } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { useSlowPending } from "../lib/useSlowPending";
import { getProductPageView, productPageTitle } from "./productPageView";

function ProductNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-6">
      <title>{productPageTitle("not-found")}</title>
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

  const view = getProductPageView({
    hasData: query.data !== undefined,
    isError: query.isError,
    isFetching: query.isFetching,
    error: query.error,
  });

  if (view === "not-found") {
    return <ProductNotFound />;
  }

  if (view === "error") {
    return (
      <>
        <title>{productPageTitle("error")}</title>
        <h1 className="sr-only">Game details</h1>
        <ErrorState onRetry={() => void query.refetch()} />
      </>
    );
  }

  if (!query.data) {
    return (
      <div className="flex flex-col gap-4">
        <title>{productPageTitle("loading")}</title>
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
      <title>{productPageTitle("ready", product.name)}</title>
      <ProductBreadcrumb name={product.name} />
      {/* DOM order is the phone order; from lg the buy box moves to a sticky right column. */}
      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-8">
        <div className="lg:col-start-1">
          <ProductTitleBlock
            product={product}
            heading={
              <h1 className="text-2xl font-extrabold break-words md:text-3xl">
                {product.name}
              </h1>
            }
          />
        </div>
        <div className="lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
          <BuyBox product={product} />
        </div>
        <div className="lg:col-start-1">
          <ProductInfoRows product={product} />
        </div>
        <div className="flex min-w-0 flex-col gap-10 lg:col-start-1">
          <OfferList
            offers={product.offers}
            bestOfferId={product.best_offer_id}
          />
          <ProductAbout product={product} />
        </div>
      </div>
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
