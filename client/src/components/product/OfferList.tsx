import type { Offer } from "../../api/products";
import { OfferRow } from "./OfferRow";

type OfferListProps = {
  offers: Offer[];
  bestOfferId: number | null;
};

// Renders offers in API order; the server already sorted them.
export function OfferList({ offers, bestOfferId }: OfferListProps) {
  return (
    <section aria-labelledby="offers-heading" className="mt-10">
      <h2 id="offers-heading" className="mb-4 text-xl font-extrabold">
        All offers
      </h2>
      {offers.length === 0 ? (
        <p className="rounded-sm border border-surface px-6 py-10 text-center text-fg-soft">
          No sellers offer this game right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {offers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              isBest={offer.id === bestOfferId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
