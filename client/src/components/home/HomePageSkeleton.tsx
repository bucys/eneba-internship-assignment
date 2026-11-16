import { Container } from "../layout/Container";
import { ProductCardSkeleton } from "../product/ProductCard";
import { HeroSkeleton } from "./HeroBanners";

const CARD_SKELETONS = 6;

/** Stands in for the whole page while the layout loads (spec 0014 AC-8). */
export function HomePageSkeleton() {
  return (
    <div aria-hidden="true">
      <HeroSkeleton />
      {/* Same padding and height as PlatformShortcuts, so the cards don't jump when it arrives. */}
      <Container className="py-6 md:py-8">
        <div data-testid="shortcuts-placeholder" className="h-19" />
      </Container>
      <Container className="py-10 md:py-14">
        <div className="mb-4 h-8 w-48 animate-pulse rounded-sm bg-surface-deep" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: CARD_SKELETONS }, (_, index) => (
            <div key={index} className="w-50 shrink-0">
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
