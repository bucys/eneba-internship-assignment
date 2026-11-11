import type { ComponentProps } from "react";
import type { Product } from "../../api/products";
import type { ProductCard } from "./ProductCard";

export type ProductCardProps = ComponentProps<typeof ProductCard>;

export function toProductCardProps(product: Product): ProductCardProps {
  return {
    slug: product.slug,
    name: product.name,
    coverImageUrl: product.cover_image_url,
    platformName: product.platform.name,
    regionName: product.region.name,
    price: product.price,
    listPrice: product.list_price,
    discountPercent: product.discount_percent,
  };
}
