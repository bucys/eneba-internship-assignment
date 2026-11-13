import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import type { Product } from "../../api/products";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { ProductCard, ProductCardSkeleton } from "../product/ProductCard";
import { toProductCardProps } from "../product/toProductCardProps";
import { Button } from "../ui/Button";
import { ScrollRail } from "../ui/ScrollRail";
import { HomeQueryBlock } from "./HomeQueryBlock";
import { HomeSection } from "./HomeSection";

const MOBILE_PREVIEW_COUNT = 4;
const DESKTOP_SKELETONS = 6;
const RAIL_ITEM_CLASS = "w-50 shrink-0 snap-start";
const DESKTOP_QUERY = "(min-width: 768px)";

// The query options factories pass a select that turns { data } into Product[].
type ProductsQueryOptions = UseQueryOptions<
  { data: Product[] },
  Error,
  Product[],
  string[]
>;

type RailProps = { title: string; products: Product[] };

export function ProductRail({ title, products }: RailProps) {
  return (
    <ScrollRail label={title} listClassName="gap-4">
      {products.map((product) => (
        <li key={product.slug} className={RAIL_ITEM_CLASS}>
          <ProductCard {...toProductCardProps(product)} />
        </li>
      ))}
    </ScrollRail>
  );
}

type MobileListProps = RailProps & {
  expanded: boolean;
  onExpand: () => void;
};

export function MobileProductList({
  products,
  expanded,
  onExpand,
}: MobileListProps) {
  const listId = useId();
  const firstRevealedRef = useRef<HTMLAnchorElement>(null);
  const focusAfterExpand = useRef(false);
  const visible = expanded ? products : products.slice(0, MOBILE_PREVIEW_COUNT);
  const hasMore = !expanded && products.length > MOBILE_PREVIEW_COUNT;

  useEffect(() => {
    if (expanded && focusAfterExpand.current) {
      focusAfterExpand.current = false;
      firstRevealedRef.current?.focus();
    }
  }, [expanded]);

  function handleShowAll() {
    focusAfterExpand.current = true;
    onExpand();
  }

  return (
    <div className="flex flex-col gap-4">
      <ul id={listId} className="flex flex-col gap-3">
        {visible.map((product, index) => (
          <li key={product.slug}>
            <ProductCard
              {...toProductCardProps(product)}
              layout="horizontal"
              ref={
                index === MOBILE_PREVIEW_COUNT ? firstRevealedRef : undefined
              }
            />
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button
          variant="secondary"
          className="self-center"
          aria-expanded={false}
          aria-controls={listId}
          onClick={handleShowAll}
        >
          Show all
        </Button>
      )}
    </div>
  );
}

type RailSkeletonProps = { title: string; isDesktop: boolean };

function ProductRailSkeleton({ title, isDesktop }: RailSkeletonProps) {
  return (
    <HomeSection title={title}>
      {isDesktop ? (
        <div aria-hidden="true" className="flex gap-4 overflow-hidden">
          {Array.from({ length: DESKTOP_SKELETONS }, (_, index) => (
            <div key={index} className={RAIL_ITEM_CLASS}>
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      ) : (
        <div aria-hidden="true" className="flex flex-col gap-3">
          {Array.from({ length: MOBILE_PREVIEW_COUNT }, (_, index) => (
            <ProductCardSkeleton key={index} layout="horizontal" />
          ))}
        </div>
      )}
    </HomeSection>
  );
}

type ProductRailBlockProps = {
  title: string;
  query: ProductsQueryOptions;
};

/** Best sellers and Deals: a rail from md up, a short list with Show all below it (spec 0014 AC-11). */
export function ProductRailBlock({
  title,
  query: options,
}: ProductRailBlockProps) {
  const query = useQuery(options);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  // Lives here, not in the list, so it survives a resize across md.
  const [expanded, setExpanded] = useState(false);

  return (
    <HomeQueryBlock
      title={title}
      query={query}
      skeleton={<ProductRailSkeleton title={title} isDesktop={isDesktop} />}
    >
      {(products) => (
        <HomeSection title={title}>
          {isDesktop ? (
            <ProductRail title={title} products={products} />
          ) : (
            <MobileProductList
              title={title}
              products={products}
              expanded={expanded}
              onExpand={() => setExpanded(true)}
            />
          )}
        </HomeSection>
      )}
    </HomeQueryBlock>
  );
}
