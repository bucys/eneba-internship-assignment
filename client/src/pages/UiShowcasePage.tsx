import type { ReactNode } from "react";
import { Container } from "../components/layout/Container";
import { Price } from "../components/product/Price";
import {
  ProductCard,
  ProductCardSkeleton,
} from "../components/product/ProductCard";
import { ProductGrid } from "../components/product/ProductGrid";
import { Alert } from "../components/ui/Alert";
import { Button, LinkButton } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { TextField } from "../components/ui/TextField";
import { useToast } from "../components/ui/toastContext";
import type { Money } from "../lib/money";

// Dev only page: router.tsx registers it behind import.meta.env.DEV.

const eur = (amount: number): Money => ({ amount, currency: "EUR" });

const sampleCards = [
  {
    slug: "sample-discounted",
    name: "Sample Quest: Discounted Edition",
    coverImageUrl: "/sample-cover.svg",
    platformName: "Steam",
    regionName: "Global",
    price: eur(998),
    listPrice: eur(1999),
    discountPercent: 50,
  },
  {
    slug: "sample-no-discount",
    name: "Sample Racer With A Very Long Name That Has To Clamp To Two Lines In The Card",
    coverImageUrl: "/sample-cover.svg",
    platformName: "Xbox Live",
    regionName: "Europe",
    price: eur(4999),
    listPrice: null,
    discountPercent: null,
  },
  {
    slug: "sample-broken-image",
    name: "Broken Image Example",
    coverImageUrl: "/does-not-exist.jpg",
    platformName: "PlayStation Network",
    regionName: "Global",
    price: eur(1250),
    listPrice: eur(1500),
    discountPercent: 17,
  },
  {
    slug: "sample-out-of-stock",
    name: "Out Of Stock Example",
    coverImageUrl: null,
    platformName: "Steam",
    regionName: "Europe",
    price: null,
    listPrice: null,
    discountPercent: null,
  },
];

type SectionProps = {
  title: string;
  children: ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-4 border-t border-surface pt-8">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function ToastDemo() {
  const toast = useToast();

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        onClick={() =>
          toast.show({ message: "Added to cart.", variant: "success" })
        }
      >
        Success toast
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast.show({ message: "Prices refresh every hour.", variant: "info" })
        }
      >
        Info toast
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast.show({
            message: "Could not add to cart. Please try again.",
            variant: "error",
          })
        }
      >
        Error toast
      </Button>
    </div>
  );
}

export function UiShowcasePage() {
  return (
    <Container className="flex flex-col gap-10 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold md:text-3xl">
          UI Showcase (dev only)
        </h1>
        <p className="max-w-prose text-sm text-fg-soft">
          Every base component in every static state. Hover and focus states are
          checked by interacting: move the mouse over controls and press Tab to
          see the yellow focus ring.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="lg">Primary large</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button loading>Buy now</Button>
          <Button variant="secondary" loading>
            Saving
          </Button>
          <Button size="lg" loading>
            Pay securely
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LinkButton to="/">Link button</LinkButton>
          <LinkButton to="/" variant="secondary">
            Secondary link
          </LinkButton>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid gap-6 md:grid-cols-2">
          <TextField
            label="Email"
            type="email"
            placeholder="you@example.com"
            hint="We send your keys here."
          />
          <TextField
            label="Email"
            type="email"
            defaultValue="not-an-email"
            error="Enter a valid email address."
          />
          <TextField label="Disabled" defaultValue="Read only value" disabled />
          <Select label="Platform" defaultValue="steam">
            <option value="steam">Steam</option>
            <option value="xbox">Xbox Live</option>
            <option value="psn">PlayStation Network</option>
          </Select>
          <Select label="Region" error="Choose a region." defaultValue="">
            <option value="" disabled>
              Choose a region
            </option>
            <option value="global">Global</option>
            <option value="eu">Europe</option>
          </Select>
          <div className="flex flex-col gap-2">
            <Checkbox label="Only show discounted offers" defaultChecked />
            <Checkbox
              label="I accept the terms"
              error="You need to accept the terms."
            />
            <Checkbox label="Email me deals" hint="At most one email a week." />
          </div>
        </div>
      </Section>

      <Section title="Price">
        <div className="flex flex-col gap-3">
          <Price price={eur(998)} listPrice={eur(1999)} discountPercent={50} />
          <Price price={eur(4999)} />
          <Price
            price={eur(998)}
            listPrice={eur(1999)}
            discountPercent={50}
            size="lg"
          />
          <Price price={eur(998)} listPrice={eur(1999)} discountPercent={0} />
          <Price price={null} />
        </div>
      </Section>

      <Section title="Product card and grid">
        <ProductGrid>
          {sampleCards.map((card) => (
            <ProductCard key={card.slug} {...card} />
          ))}
          <ProductCardSkeleton />
        </ProductGrid>
      </Section>

      <Section title="Loading, empty and error states">
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <EmptyState
          title="No games found"
          message="Try a different search or clear the filters."
          action={
            <LinkButton to="/" variant="secondary">
              Clear filters
            </LinkButton>
          }
        />
        <ErrorState onRetry={() => undefined} />
      </Section>

      <Section title="Alerts">
        <Alert variant="info">
          Keys are delivered instantly after payment.
        </Alert>
        <Alert variant="success">Your order is complete.</Alert>
        <Alert variant="error" role="status">
          This offer sold out while you were checking out.
        </Alert>
      </Section>

      <Section title="Toasts">
        <p className="text-sm text-fg-soft">
          Info and success close after 4 seconds (paused while hovered or
          focused). Error stays until dismissed. At most 3 show at once.
        </p>
        <ToastDemo />
      </Section>
    </Container>
  );
}
