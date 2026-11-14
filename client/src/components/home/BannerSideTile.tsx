import { Link } from "react-router";
import type { Banner } from "../../api/home";
import { cx } from "../../lib/cx";
import { CoverImage } from "../product/CoverImage";
import { Price } from "../product/Price";

type BannerSideTileProps = {
  banner: Banner;
  className?: string;
};

/** A desktop hero side tile: text on the left, the product cover on the right (spec 0015 AC-10). */
export function BannerSideTile({ banner, className }: BannerSideTileProps) {
  const { product } = banner;

  return (
    <Link
      to={`/products/${product.slug}`}
      className={cx(
        "group flex min-h-0 items-center gap-4 overflow-hidden rounded-sm bg-surface-deep p-4 transition-shadow hover:ring-1 hover:ring-accent hover:ring-inset focus-visible:-outline-offset-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="line-clamp-2 text-lg leading-tight font-extrabold text-fg">
          {banner.title}
        </span>
        <Price
          price={product.price}
          listPrice={product.list_price}
          discountPercent={product.discount_percent}
        />
        <span className="self-start rounded-full bg-cta px-3 py-1.5 text-xs font-extrabold text-cta-fg transition-colors group-hover:bg-cta-hover">
          {banner.cta_label}
        </span>
      </div>
      <div className="h-full max-h-full shrink-0 aspect-[2/3]">
        <CoverImage url={product.cover_image_url} alt="" className="h-full" />
      </div>
    </Link>
  );
}
