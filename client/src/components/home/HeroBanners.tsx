import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { homeBannersQuery, type Banner } from "../../api/home";
import { ScrollRail } from "../ui/ScrollRail";
import { Skeleton } from "../ui/Skeleton";
import { BannerTile } from "./BannerTile";
import { HomeQueryBlock } from "./HomeQueryBlock";

// About 2.5 tiles below sm, 3.5 from sm, 5 from md, 6 from lg (spec 0014 AC-10).
const TILE_CLASS = "w-2/5 shrink-0 snap-start sm:w-[28.5%] md:w-1/5 lg:w-1/6";
const EAGER_TILES = 3;
const SKELETON_TILES = 6;

export function HeroStripSkeleton() {
  return (
    <div aria-hidden="true" className="flex overflow-hidden">
      {Array.from({ length: SKELETON_TILES }, (_, index) => (
        <div key={index} className={TILE_CLASS}>
          <Skeleton className="aspect-[1/2] w-full rounded-none border-r border-bg" />
        </div>
      ))}
    </div>
  );
}

type HeroStripProps = {
  title: string;
  banners: Banner[];
};

export function HeroStrip({ title, banners }: HeroStripProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {title}
      </h2>
      <ScrollRail label={title}>
        {banners.map((banner, index) => (
          <li key={banner.id} className={TILE_CLASS}>
            <BannerTile
              banner={banner}
              loading={index < EAGER_TILES ? "eager" : "lazy"}
            />
          </li>
        ))}
      </ScrollRail>
    </section>
  );
}

type HeroBannersProps = { title: string };

export function HeroBanners({ title }: HeroBannersProps) {
  const query = useQuery(homeBannersQuery());

  return (
    <HomeQueryBlock
      title={title}
      query={query}
      skeleton={<HeroStripSkeleton />}
    >
      {(banners) => <HeroStrip title={title} banners={banners} />}
    </HomeQueryBlock>
  );
}
