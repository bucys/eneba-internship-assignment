import { useQuery } from "@tanstack/react-query";
import { Fragment, type ComponentType } from "react";
import { ApiError } from "../api/client";
import {
  HOME_BLOCK_QUERIES,
  homeLayoutQuery,
  type HomeBlockType,
} from "../api/home";
import { HeroBanners } from "../components/home/HeroBanners";
import { HomePageSkeleton } from "../components/home/HomePageSkeleton";
import { PlatformShortcuts } from "../components/home/PlatformShortcuts";
import { ProductRailBlock } from "../components/home/ProductRailBlock";
import { Container } from "../components/layout/Container";
import { ProductListSection } from "../components/product/ProductListSection";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { useSlowPending } from "../lib/useSlowPending";

type BlockProps = { title: string };

function BestSellersBlock({ title }: BlockProps) {
  return (
    <ProductRailBlock title={title} query={HOME_BLOCK_QUERIES.best_sellers()} />
  );
}

function DealsBlock({ title }: BlockProps) {
  return <ProductRailBlock title={title} query={HOME_BLOCK_QUERIES.deals()} />;
}

// Typed by HOME_BLOCK_QUERIES, so a block without a prefetched query (or the reverse) fails typecheck.
const BLOCK_COMPONENTS: Record<HomeBlockType, ComponentType<BlockProps>> = {
  banners: HeroBanners,
  best_sellers: BestSellersBlock,
  deals: DealsBlock,
  products: ProductListSection,
};

// A Map, so a layout type like "constructor" can never match an object prototype key.
const BLOCKS = new Map(Object.entries(BLOCK_COMPONENTS));

function HomeBody() {
  const layout = useQuery(homeLayoutQuery());
  // isFetching (not isPending) so the notice also shows while Try again refetches.
  const isSlow = useSlowPending(layout.isFetching && !layout.data);

  if (layout.isError && !layout.isFetching) {
    const message =
      layout.error instanceof ApiError ? layout.error.message : undefined;
    return (
      <Container className="py-10">
        <ErrorState message={message} onRetry={() => void layout.refetch()} />
      </Container>
    );
  }

  if (!layout.data) {
    return (
      <>
        {isSlow && (
          <Container className="pt-6">
            <Alert role="status">
              Waking up the server. The first visit after a quiet spell can take
              up to a minute.
            </Alert>
          </Container>
        )}
        <HomePageSkeleton />
      </>
    );
  }

  const blocks = layout.data.flatMap((block) => {
    const Block = BLOCKS.get(block.type);
    return Block ? [{ ...block, Block }] : [];
  });

  if (blocks.length === 0) {
    return (
      <Container className="py-10">
        <EmptyState title="Nothing here yet" message="Check back soon." />
      </Container>
    );
  }

  // The platform shortcuts sit right under the hero, or first when the layout has none.
  const hasHero = blocks.some(({ type }) => type === "banners");

  return (
    <div className="home-bands">
      {!hasHero && <PlatformShortcuts />}
      {blocks.map(({ type, title, Block }) => (
        <Fragment key={type}>
          <Block title={title} />
          {type === "banners" && <PlatformShortcuts />}
        </Fragment>
      ))}
    </div>
  );
}

export function HomePage() {
  return (
    <>
      <h1 className="sr-only">Buy game keys at the best prices</h1>
      <HomeBody />
    </>
  );
}
