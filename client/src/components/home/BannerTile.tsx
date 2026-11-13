import { Gamepad2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { Banner } from "../../api/home";
import { Price } from "../product/Price";

type BannerTileProps = {
  banner: Banner;
  loading: "eager" | "lazy";
};

/** A portrait promo tile: one link whose name is its visible text (spec 0014 AC-10). */
export function BannerTile({ banner, loading }: BannerTileProps) {
  const [broken, setBroken] = useState(false);
  const { product } = banner;

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group relative block aspect-[1/2] overflow-hidden bg-surface-deep focus-visible:-outline-offset-2"
    >
      {broken ? (
        <div className="flex size-full items-center justify-center">
          <Gamepad2 aria-hidden="true" className="size-10 text-fg-muted" />
        </div>
      ) : (
        <img
          src={banner.image_url}
          alt=""
          loading={loading}
          onError={() => setBroken(true)}
          className="size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
        />
      )}
      {/* The fade sits above the text, so every line of copy is on opaque black/90. */}
      <div className="absolute inset-x-0 bottom-0 flex min-h-3/5 flex-col">
        <div className="min-h-12 flex-1 bg-linear-to-t from-black/90 to-transparent" />
        <div className="flex flex-col gap-2 bg-black/90 px-3 pb-3 md:px-4 md:pb-4">
          <span className="line-clamp-2 text-base leading-tight font-extrabold text-fg md:text-lg">
            {banner.title}
          </span>
          <span className="line-clamp-3 text-xs text-fg-soft">
            {banner.tagline}
          </span>
          <Price
            price={product.price}
            listPrice={product.list_price}
            discountPercent={product.discount_percent}
          />
          <span className="self-start rounded-full bg-cta px-3 py-1.5 text-xs font-extrabold text-cta-fg">
            {banner.cta_label}
          </span>
        </div>
      </div>
    </Link>
  );
}
