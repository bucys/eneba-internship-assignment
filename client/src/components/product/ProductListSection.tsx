import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { HOME_BLOCK_QUERIES } from "../../api/home";
import { HomeQueryBlock } from "../home/HomeQueryBlock";
import { HomeSection } from "../home/HomeSection";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { ProductGrid } from "./ProductGrid";
import { toProductCardProps } from "./toProductCardProps";

const SKELETON_COUNT = 12;

const seeAll = (
  <Link
    to="/store"
    className="inline-flex min-h-11 items-center text-sm font-semibold text-link hover:underline"
  >
    See all
  </Link>
);

type ProductListSectionProps = { title: string };

/** The homepage `products` block: page 1 of GET /products, keeping its own query key. */
export function ProductListSection({ title }: ProductListSectionProps) {
  const query = useQuery({
    ...HOME_BLOCK_QUERIES.products(),
    select: (response) => response.data,
  });

  return (
    <HomeQueryBlock
      title={title}
      query={query}
      skeleton={
        <HomeSection title={title} action={seeAll}>
          <ProductGrid>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </ProductGrid>
        </HomeSection>
      }
    >
      {(products) => (
        <HomeSection title={title} action={seeAll}>
          <ProductGrid>
            {products.map((product) => (
              <ProductCard
                key={product.slug}
                {...toProductCardProps(product)}
              />
            ))}
          </ProductGrid>
        </HomeSection>
      )}
    </HomeQueryBlock>
  );
}
