import { useState } from "react";
import { Link } from "react-router";
import type { Banner } from "../../api/home";
import { cx } from "../../lib/cx";
import { Price } from "../product/Price";
import { buttonClasses } from "../ui/buttonClasses";

type FeaturedBannerProps = {
  banner: Banner;
  className?: string;
};

/**
 * The wide desktop hero slot (spec 0015 AC-9). Every word is DOM text; the art is
 * decorative and drops out on error, leaving the gradient on `surface-deep`.
 */
export function FeaturedBanner({ banner, className }: FeaturedBannerProps) {
  const [broken, setBroken] = useState(false);
  const { product } = banner;

  return (
    <Link
      to={`/products/${product.slug}`}
      className={cx(
        "group relative block overflow-hidden rounded-sm bg-surface-deep focus-visible:-outline-offset-2",
        className,
      )}
    >
      {!broken && (
        <img
          src={banner.image_url}
          alt=""
          loading="eager"
          fetchPriority="high"
          onError={() => setBroken(true)}
          className="absolute inset-0 size-full object-cover object-right transition-transform duration-300 motion-safe:group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-surface-deep/95 to-transparent to-60%" />
      <div className="relative flex h-full max-w-[26rem] flex-col justify-center gap-4 p-8 xl:p-10">
        <span className="text-3xl leading-tight font-extrabold text-fg xl:text-4xl">
          {banner.title}
        </span>
        {/* Below xl the slot is narrow enough that the tagline runs onto the art's subject. */}
        <span className="hidden text-fg-soft xl:line-clamp-2">
          {banner.tagline}
        </span>
        <Price
          price={product.price}
          listPrice={product.list_price}
          discountPercent={product.discount_percent}
          size="lg"
        />
        <span
          className={buttonClasses(
            "primary",
            "md",
            "self-start group-hover:bg-cta-hover",
          )}
        >
          {banner.cta_label}
        </span>
      </div>
    </Link>
  );
}
