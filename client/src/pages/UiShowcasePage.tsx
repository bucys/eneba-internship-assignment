import { useState, type ReactNode } from "react";
import type { Cart, CartLine } from "../api/cart";
import { CardPaymentForm } from "../components/checkout/CardPaymentForm";
import { CheckoutPageSkeleton } from "../components/checkout/CheckoutPageSkeleton";
import { CheckoutSummary } from "../components/checkout/CheckoutSummary";
import { KeySlot } from "../components/orders/KeySlot";
import { OrderItemRow } from "../components/orders/OrderItemRow";
import { OrderListSkeleton } from "../components/orders/OrderListSkeleton";
import { OrderSummaryRow } from "../components/orders/OrderSummaryRow";
import { OrderPageSkeleton } from "../components/orders/OrderPageSkeleton";
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
import { Pagination } from "../components/ui/Pagination";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { TextField } from "../components/ui/TextField";
import { useToast } from "../components/ui/toastContext";
import type { Money } from "../lib/money";
import { ordersPageHref } from "../lib/orderHistory";
import { ActiveFilterChips } from "../components/store/ActiveFilterChips";
import { FiltersButton } from "../components/store/FiltersDialog";
import { StoreFilterPanel } from "../components/store/StoreFilterPanel";
import { DEFAULT_STORE_PARAMS, type StoreParams } from "../lib/storeParams";
import { SearchSuggestions } from "../components/layout/SearchSuggestions";
import type { SuggestionsView } from "../lib/suggestionsView";
import { HomeBlocksShowcase } from "./HomeBlocksShowcase";

// Dev only page: router.tsx registers it behind import.meta.env.DEV.

const sampleFilterOptions = {
  platforms: [
    { slug: "steam", name: "Steam" },
    { slug: "xbox", name: "Xbox Live" },
    { slug: "psn", name: "PlayStation Network" },
  ],
  regions: [
    { slug: "europe", name: "Europe" },
    { slug: "global", name: "Global" },
  ],
};

/** The panel and chips wired to local state, so every control can be tried here. */
function StoreFiltersDemo() {
  const [params, setParams] = useState<StoreParams>({
    ...DEFAULT_STORE_PARAMS,
    q: "a very long search term that has to truncate inside its chip",
    platform: ["steam", "unknown-slug"],
    priceMin: 10,
    priceMax: 30,
    sort: "price_asc",
  });
  const options = { status: "ready" as const, options: sampleFilterOptions };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-fg-soft">Loaded</p>
        <StoreFilterPanel
          params={params}
          options={options}
          onChange={setParams}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-fg-soft">Loading</p>
        <StoreFilterPanel
          params={params}
          options={{ status: "loading" }}
          onChange={setParams}
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-fg-soft">Error</p>
        <StoreFilterPanel
          params={params}
          options={{ status: "error", onRetry: () => {} }}
          onChange={setParams}
        />
      </div>
      <div className="flex flex-col gap-3 md:col-span-3">
        <p className="text-sm text-fg-soft">Chips (unknown slug shows as is)</p>
        <ActiveFilterChips
          params={params}
          options={sampleFilterOptions}
          onChange={setParams}
        />
        <div className="flex flex-wrap gap-3">
          <FiltersButton count={0} />
          <FiltersButton count={3} />
        </div>
      </div>
    </div>
  );
}

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

function sampleLine(offerId: number, overrides: Partial<CartLine>): CartLine {
  return {
    offer_id: offerId,
    quantity: 1,
    max_quantity: 10,
    available: true,
    quantity_reduced: false,
    unit_price: eur(998),
    line_total: eur(998),
    seller: { name: "KeyHub" },
    product: {
      slug: "sample-discounted",
      name: "Sample Quest: Discounted Edition",
      cover_image_url: "/sample-cover.svg",
      platform: { slug: "steam", name: "Steam" },
      region: { slug: "global", name: "Global" },
    },
    ...overrides,
  };
}

const sampleCheckoutCart: Cart = {
  lines: [
    sampleLine(1, {
      quantity: 3,
      max_quantity: 3,
      quantity_reduced: true,
      line_total: eur(2994),
    }),
    sampleLine(2, { unit_price: eur(4999), line_total: eur(4999) }),
  ],
  item_count: 4,
  total: eur(7993),
  can_checkout: true,
};

const sampleSuggestionsView: SuggestionsView = {
  status: "results",
  isStale: false,
  suggestions: [
    {
      slug: "witcher-3",
      name: "The Witcher 3: Wild Hunt",
      cover_image_url: "",
      platform: { slug: "steam", name: "Steam" },
      price: eur(1299),
    },
    {
      slug: "witcher-3-blood-and-wine",
      name: "The Witcher 3: Wild Hunt Blood and Wine, a very long expansion name that wraps",
      cover_image_url: "",
      platform: { slug: "gog", name: "GOG" },
      price: null,
    },
  ],
};

const suggestionStates: {
  label: string;
  term: string;
  view: SuggestionsView;
  active?: number;
}[] = [
  {
    label: "Results, first row active",
    term: "witch hunt",
    view: sampleSuggestionsView,
    active: 0,
  },
  {
    label: "Next term loading (dimmed)",
    term: "witch hunt",
    view: { ...sampleSuggestionsView, isStale: true },
  },
  { label: "Searching", term: "witc", view: { status: "searching" } },
  {
    label: "No matches",
    term: "zzzz",
    view: { status: "results", suggestions: [], isStale: false },
  },
  { label: "Unavailable", term: "witcher", view: { status: "unavailable" } },
];

function SearchSuggestionsDemo() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {suggestionStates.map((state, index) => (
        <div key={state.label} className="flex flex-col gap-2">
          <p className="text-sm text-fg-soft">{state.label}</p>
          {/* Holds the absolute dropdown, like the header search form. */}
          <div className="relative h-72">
            <SearchSuggestions
              listboxId={`ui-suggestions-${index}`}
              optionId={(option) => `ui-suggestions-${index}-${option}`}
              view={state.view}
              term={state.term}
              activeIndex={state.active ?? -1}
              onSelect={() => {}}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

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

      <Section title="Homepage blocks">
        <HomeBlocksShowcase />
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

      <Section title="Checkout and order">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem] md:items-start">
          <CardPaymentForm
            onSubmit={() => undefined}
            pending={false}
            totalLabel="€79.93"
          />
          <CheckoutSummary cart={sampleCheckoutCart} />
        </div>
        <CardPaymentForm
          onSubmit={() => undefined}
          pending={false}
          fieldErrors={{
            card_number: "Enter a valid card number.",
            card_expiry: "This card has expired.",
          }}
          formError="Your card was declined."
          totalLabel="€79.93"
        />
        <CardPaymentForm
          onSubmit={() => undefined}
          pending
          totalLabel="€79.93"
        />
        <ul className="flex flex-col gap-2">
          <OrderItemRow
            item={{
              id: 1,
              product: {
                slug: "sample-discounted",
                cover_image_url: "/sample-cover.svg",
              },
              product_name: "Sample Quest: Discounted Edition",
              platform_name: "Steam",
              region_name: "Global",
              seller_name: "KeyHub",
              quantity: 3,
              unit_price: eur(998),
              line_total: eur(2994),
            }}
          />
        </ul>
        <ul aria-label="Key slot states" className="flex flex-col gap-2">
          {(
            [
              ["masked", {}],
              ["pending", {}],
              ["revealed", { code: "SAMPL-EKEY1-23456" }],
              [
                "revealed",
                { code: "SAMPL-EKEY1-23456", initialCopyState: "copied" },
              ],
              [
                "revealed",
                { code: "SAMPL-EKEY1-23456", initialCopyState: "fallback" },
              ],
              ["masked", { error: "Could not load your key." }],
            ] as const
          ).map(([state, extra], index) => (
            <KeySlot
              key={index}
              label={`key ${index + 1} of 6 for Sample Quest`}
              state={state}
              onToggle={() => undefined}
              onRetry={() => undefined}
              onCopied={() => undefined}
              {...extra}
            />
          ))}
        </ul>
        <CheckoutPageSkeleton />
        <OrderPageSkeleton />
      </Section>

      <Section title="Order history">
        <ul aria-label="Sample orders" className="flex flex-col gap-2">
          <OrderSummaryRow
            fromPage={1}
            order={{
              ulid: "01jsampleorder000000one000",
              status: "paid",
              total: eur(1999),
              paid_at: "2026-11-13T10:24:51Z",
              item_count: 1,
              line_count: 1,
              first_item: {
                product_name: "Sample Quest",
                cover_image_url: null,
              },
            }}
          />
          <OrderSummaryRow
            fromPage={1}
            order={{
              ulid: "01jsampleorder00000many000",
              status: "paid",
              total: eur(7496),
              paid_at: "2026-10-02T18:05:00Z",
              item_count: 4,
              line_count: 3,
              first_item: {
                product_name:
                  "A Very Long Sample Game Title That Wraps On Small Screens",
                cover_image_url: null,
              },
            }}
          />
        </ul>
        {[1, 2, 3].map((page) => (
          <Pagination
            key={page}
            page={page}
            lastPage={3}
            hrefFor={ordersPageHref}
            label={`Sample pages, page ${page}`}
          />
        ))}
        <OrderListSkeleton />
      </Section>

      <Section title="Store filters">
        <StoreFiltersDemo />
      </Section>

      <Section title="Search suggestions">
        <SearchSuggestionsDemo />
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
