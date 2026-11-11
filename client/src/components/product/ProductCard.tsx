import { Gamepad2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { Money } from "../../lib/money";
import { Skeleton } from "../ui/Skeleton";
import { Price } from "./Price";

// One place to change the cover ratio once feature 5 picks the seed images.
const COVER_ASPECT_CLASS = "aspect-[2/3]";

type ProductCardProps = {
  slug: string;
  name: string;
  coverImageUrl: string | null;
  platformName: string;
  regionName: string;
  price: Money | null;
  listPrice: Money | null;
  discountPercent: number | null;
};

type CoverImageProps = {
  url: string | null;
  alt: string;
};

function CoverImage({ url, alt }: CoverImageProps) {
  const [broken, setBroken] = useState(false);

  return (
    <div
      className={`${COVER_ASPECT_CLASS} w-full overflow-hidden rounded-sm bg-surface-deep`}
    >
      {url && !broken ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Gamepad2 aria-hidden="true" className="size-10 text-fg-muted" />
        </div>
      )}
    </div>
  );
}

export function ProductCard({
  slug,
  name,
  coverImageUrl,
  platformName,
  regionName,
  price,
  listPrice,
  discountPercent,
}: ProductCardProps) {
  return (
    <Link
      to={`/products/${slug}`}
      className="flex h-full flex-col gap-3 rounded-sm bg-surface p-3 transition-colors hover:bg-surface-deep"
    >
      <CoverImage key={coverImageUrl} url={coverImageUrl} alt={name} />
      <div className="flex flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-sm font-semibold text-fg">
          {name}
        </span>
        <span className="text-xs text-fg-muted">
          {platformName} · {regionName}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {price !== null && <span className="text-xs text-fg-muted">From</span>}
        <Price
          price={price}
          listPrice={listPrice}
          discountPercent={discountPercent}
        />
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col gap-3 rounded-sm bg-surface p-3"
    >
      <Skeleton className={`${COVER_ASPECT_CLASS} w-full`} />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="mt-2 h-5 w-1/3" />
    </div>
  );
}
