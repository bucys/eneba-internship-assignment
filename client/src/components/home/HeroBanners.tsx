import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { HOME_BLOCK_QUERIES, type Banner } from "../../api/home";
import { cx } from "../../lib/cx";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { Container } from "../layout/Container";
import { Skeleton } from "../ui/Skeleton";
import { BannerSideTile } from "./BannerSideTile";
import { CompactFeaturedBanner } from "./CompactFeaturedBanner";
import { FeaturedBanner } from "./FeaturedBanner";
import { HomeQueryBlock } from "./HomeQueryBlock";

// The split hero from lg (spec 0015 AC-8, AC-11). Only one layout is ever mounted.
export const SPLIT_HERO_QUERY = "(min-width: 64rem)";
const SPLIT_GRID_CLASS = "grid h-[22.5rem] grid-cols-3 grid-rows-2 gap-4";
// Matches CompactFeaturedBanner: a 2:1 art band plus the text strip below sm, h-64 from sm.
export function HeroCompactSkeleton() {
  return (
    <Container className="pt-4">
      <div aria-hidden="true" className="flex flex-col sm:h-64">
        <Skeleton className="aspect-[2/1] rounded-b-none sm:aspect-auto sm:h-full sm:rounded-sm" />
        <Skeleton className="h-13 rounded-t-none sm:hidden" />
      </div>
    </Container>
  );
}

export function HeroSplitSkeleton() {
  return (
    <Container className="pt-6">
      <div aria-hidden="true" className={SPLIT_GRID_CLASS}>
        <Skeleton className="col-span-2 row-span-2" />
        <Skeleton />
        <Skeleton />
      </div>
    </Container>
  );
}

/** The loading stand in for whichever hero layout this viewport mounts. */
export function HeroSkeleton() {
  const isSplit = useMediaQuery(SPLIT_HERO_QUERY);
  return isSplit ? <HeroSplitSkeleton /> : <HeroCompactSkeleton />;
}

type HeroLayoutProps = {
  title: string;
  banners: Banner[];
};

export function HeroSplit({ title, banners }: HeroLayoutProps) {
  const headingId = useId();
  const [featured, ...rest] = banners;
  const sideTiles = rest.slice(0, 2);

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {title}
      </h2>
      <Container className="pt-6">
        <div className={SPLIT_GRID_CLASS}>
          <FeaturedBanner
            banner={featured}
            className={cx(
              "row-span-2",
              sideTiles.length === 0 ? "col-span-3" : "col-span-2",
            )}
          />
          {sideTiles.map((banner) => (
            <BannerSideTile
              key={banner.id}
              banner={banner}
              className={sideTiles.length === 1 ? "row-span-2" : undefined}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}

/** Below lg: only the first banner, with the same wide art as the desktop featured slot. */
export function HeroCompact({ title, banners }: HeroLayoutProps) {
  const headingId = useId();
  const [featured] = banners;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {title}
      </h2>
      <Container className="pt-4">
        <CompactFeaturedBanner banner={featured} />
      </Container>
    </section>
  );
}

type HeroBannersProps = { title: string };

export function HeroBanners({ title }: HeroBannersProps) {
  const query = useQuery(HOME_BLOCK_QUERIES.banners());
  const isSplit = useMediaQuery(SPLIT_HERO_QUERY);

  return (
    <HomeQueryBlock
      title={title}
      query={query}
      skeleton={isSplit ? <HeroSplitSkeleton /> : <HeroCompactSkeleton />}
    >
      {(banners) =>
        isSplit ? (
          <HeroSplit title={title} banners={banners} />
        ) : (
          <HeroCompact title={title} banners={banners} />
        )
      }
    </HomeQueryBlock>
  );
}
