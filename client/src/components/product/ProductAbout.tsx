import type { ProductDetail } from "../../api/products";
import { formatReleaseDate } from "../../lib/format";

type ProductAboutProps = {
  product: ProductDetail;
};

export function ProductAbout({ product }: ProductAboutProps) {
  const facts = [
    { label: "Developer", value: product.developer },
    { label: "Publisher", value: product.publisher },
    {
      label: "Release date",
      value: product.release_date && formatReleaseDate(product.release_date),
    },
  ].filter((fact) => fact.value !== null);

  if (product.description === null && facts.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="about-heading" className="mt-10">
      <h2 id="about-heading" className="mb-4 text-xl font-extrabold">
        About
      </h2>
      {product.description !== null && (
        <p className="max-w-prose whitespace-pre-line text-fg-soft">
          {product.description}
        </p>
      )}
      {facts.length > 0 && (
        <dl className="mt-6 grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-fg-muted">{fact.label}</dt>
              <dd className="text-fg">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
