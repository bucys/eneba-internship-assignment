import { useState } from "react";
import { Link } from "react-router";
import type { Banner } from "../../api/home";
import { cx } from "../../lib/cx";
import { Price } from "../product/Price";
import { buttonClasses } from "../ui/buttonClasses";

type CompactFeaturedBannerProps = {
  banner: Banner;
};

/**
 * The featured hero below lg, using the same wide art as the desktop slot. The art's
 * subject sits in its right half, so text never goes over it: below sm the art is a 2:1
 * band cropped to the subject with the text underneath; from sm the text sits on a left
 * gradient as on desktop. Every word is DOM text; on an art error the band is dropped.
 */
export function CompactFeaturedBanner({ banner }: CompactFeaturedBannerProps) {
  const [broken, setBroken] = useState(false);
  const { product } = banner;

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-sm bg-surface-deep focus-visible:-outline-offset-2 sm:block sm:h-64"
    >
      <div
        className={cx(
          "relative aspect-[2/1] sm:absolute sm:inset-0 sm:aspect-auto",
          broken && "max-sm:hidden",
        )}
      >
        {!broken && (
          <img
            src={banner.image_url}
            alt=""
            loading="eager"
            fetchPriority="high"
            onError={() => setBroken(true)}
            className="absolute inset-0 size-full object-cover object-[85%_50%] transition-transform duration-300 motion-safe:group-hover:scale-105 sm:object-right"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-surface-deep to-transparent to-45% sm:bg-linear-to-r sm:from-surface-deep/95 sm:to-60%" />
      </div>

      <div
        className={cx(
          "relative flex items-end justify-between gap-3 px-4 pb-4 sm:mt-0 sm:h-full sm:max-w-[45%] sm:flex-col sm:items-start sm:justify-center sm:gap-3 sm:p-8",
          broken ? "pt-4" : "-mt-8",
        )}
      >
        <div className="flex min-w-0 flex-col gap-1 sm:gap-3">
          <span className="text-xl leading-tight font-extrabold text-fg sm:text-3xl">
            {banner.title}
          </span>
          <Price
            price={product.price}
            listPrice={product.list_price}
            discountPercent={product.discount_percent}
          />
        </div>
        <span
          className={buttonClasses(
            "primary",
            "md",
            "shrink-0 group-hover:bg-cta-hover",
          )}
        >
          {banner.cta_label}
        </span>
      </div>
    </Link>
  );
}
