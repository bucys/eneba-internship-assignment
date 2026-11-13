import { queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../api/client";
import type { Banner } from "../api/home";
import type { Product } from "../api/products";
import { HeroStrip, HeroStripSkeleton } from "../components/home/HeroBanners";
import {
  MobileProductList,
  ProductRail,
  ProductRailBlock,
} from "../components/home/ProductRailBlock";
import {
  ProductCard,
  ProductCardSkeleton,
} from "../components/product/ProductCard";
import { toProductCardProps } from "../components/product/toProductCardProps";

// Dev only: rendered inside UiShowcasePage (spec 0014 AC-13).

const SAMPLE_COVER = "/sample-cover.svg";

function sampleProduct(index: number, discounted: boolean): Product {
  return {
    slug: `sample-${index}`,
    name: `Sample Game ${index}`,
    type: "game",
    cover_image_url: SAMPLE_COVER,
    platform: { slug: "steam", name: "Steam" },
    region: { slug: "global", name: "Global" },
    price: { amount: 999 + index * 100, currency: "EUR" },
    list_price: discounted ? { amount: 2999, currency: "EUR" } : null,
    discount_percent: discounted ? 50 - index : null,
  };
}

const sampleProducts = Array.from({ length: 10 }, (_, index) =>
  sampleProduct(index + 1, index % 2 === 0),
);

const sampleBanners: Banner[] = sampleProducts.slice(0, 8).map((product) => ({
  id: Number(product.slug.split("-")[1]),
  title: product.name,
  tagline:
    "An original tagline that runs long enough to show how three lines clamp on a narrow tile.",
  cta_label: "Buy now",
  image_url: product.slug === "sample-2" ? "/does-not-exist.jpg" : SAMPLE_COVER,
  product:
    product.slug === "sample-3"
      ? { ...product, price: null, discount_percent: null }
      : product,
}));

const loadingQuery = queryOptions({
  queryKey: ["ui", "rail-loading"],
  queryFn: () => new Promise<{ data: Product[] }>(() => {}),
  select: (response) => response.data,
});

const errorQuery = queryOptions({
  queryKey: ["ui", "rail-error"],
  queryFn: (): Promise<{ data: Product[] }> =>
    Promise.reject(
      new ApiError({
        kind: "http",
        status: 500,
        message: "Something broke on our side. Please try again.",
      }),
    ),
  select: (response) => response.data,
  retry: false,
});

const emptyQuery = queryOptions({
  queryKey: ["ui", "rail-empty"],
  queryFn: async () => ({ data: [] as Product[] }),
  select: (response) => response.data,
});

function MobileListDemo() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="max-w-sm">
      <MobileProductList
        title="Best sellers"
        products={sampleProducts}
        expanded={expanded}
        onExpand={() => setExpanded(true)}
      />
    </div>
  );
}

export function HomeBlocksShowcase() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h3 className="font-extrabold">Hero tile strip</h3>
        <p className="text-sm text-fg-soft">
          Tile 2 has a broken image, tile 3 is out of stock. Arrows show from md
          up when the strip overflows.
        </p>
        <HeroStrip title="Featured" banners={sampleBanners} />
        <HeroStripSkeleton />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-extrabold">Product rail (desktop)</h3>
        <ProductRail title="Deals" products={sampleProducts} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-extrabold">Mobile list with Show all</h3>
        <MobileListDemo />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-extrabold">Horizontal card</h3>
        <div className="flex max-w-sm flex-col gap-3">
          <ProductCard
            {...toProductCardProps(sampleProducts[0])}
            layout="horizontal"
          />
          <ProductCardSkeleton layout="horizontal" />
        </div>
      </div>
      <div className="home-bands flex flex-col">
        <h3 className="font-extrabold">Block states: loading, error, empty</h3>
        <ProductRailBlock title="Loading block" query={loadingQuery} />
        <ProductRailBlock title="Error block" query={errorQuery} />
        <ProductRailBlock
          title="Empty block (renders nothing)"
          query={emptyQuery}
        />
        <p className="text-sm text-fg-soft">
          The empty block above renders nothing, so no band appears for it.
        </p>
      </div>
    </div>
  );
}
