import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useRevalidator,
  useRouteError,
} from "react-router";
import { ApiError } from "../api/client";
import { orderQuery, type Order } from "../api/orders";
import { Container } from "../components/layout/Container";
import { OrderItemRow } from "../components/orders/OrderItemRow";
import { OrderKeys } from "../components/orders/OrderKeys";
import { OrderPageSkeleton } from "../components/orders/OrderPageSkeleton";
import { Price } from "../components/product/Price";
import { Alert } from "../components/ui/Alert";
import { LinkButton } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { ordersPageHref, readFromPage } from "../lib/orderHistory";
import { useOrderKeys } from "../lib/orderKeys";
import { useSlowPending } from "../lib/useSlowPending";
import {
  isOrderNotFound,
  ORDER_CONFIRMED_TITLE,
  ORDER_DETAILS_TITLE,
  ORDER_NOT_FOUND_TITLE,
} from "./orderPageView";

const paidAtFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function PageShell({
  heading,
  title,
  backTo,
  children,
}: {
  heading: string;
  title: string;
  /** Shown above the heading on every visit that is not the one right after paying. */
  backTo?: string;
  children: ReactNode;
}) {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <title>{title}</title>
      {backTo && (
        <Link
          to={backTo}
          className="-mb-2 inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-link transition-colors hover:text-fg"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Back to my orders
        </Link>
      )}
      <h1 className="text-2xl font-extrabold md:text-3xl">{heading}</h1>
      {children}
    </Container>
  );
}

// Rendered with key={order.ulid}, so reveal state never carries over to another order.
function OrderDetails({ order }: { order: Order }) {
  const keys = useOrderKeys(order.ulid);

  return (
    <>
      <p className="text-fg-soft">
        Order{" "}
        <span className="font-semibold break-all text-fg">
          {order.ulid.toUpperCase()}
        </span>
        {" · "}
        <time dateTime={order.paid_at}>
          {paidAtFormat.format(new Date(order.paid_at))}
        </time>
      </p>
      <p className="text-fg-soft">
        Your keys are ready. Reveal a key to copy it.
      </p>
      <p role="status" className="sr-only">
        {/* A new node per announcement, so a repeated Copy is read again. */}
        <span key={keys.statusKey}>{keys.statusText}</span>
      </p>
      <ul aria-label="Order items" className="flex flex-col gap-2">
        {order.items.map((item) => (
          <OrderItemRow key={item.id} item={item}>
            <OrderKeys item={item} keys={keys} />
          </OrderItemRow>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-4 rounded-sm bg-surface p-5">
        <span className="font-semibold">Total</span>
        <Price price={order.total} size="lg" />
      </div>
      <LinkButton to="/" size="lg" className="self-start">
        Continue shopping
      </LinkButton>
    </>
  );
}

function isJustPaid(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    "justPaid" in state &&
    state.justPaid === true
  );
}

/**
 * Checkout's navigate carries `justPaid`. It is read once, on mount, then cleared from this
 * history entry, so a reload or a later visit says "Order details" (spec 0011 AC-7).
 */
function useArrival() {
  const location = useLocation();
  const navigate = useNavigate();
  const [justPaid] = useState(() => isJustPaid(location.state));
  const hasState = location.state !== null && location.state !== undefined;

  useEffect(() => {
    if (justPaid && hasState) {
      void navigate(".", { replace: true, state: null });
    }
  }, [justPaid, hasState, navigate]);

  return justPaid
    ? { heading: "Payment successful", title: ORDER_CONFIRMED_TITLE }
    : {
        heading: "Order details",
        title: ORDER_DETAILS_TITLE,
        backTo: ordersPageHref(readFromPage(location.state)),
      };
}

export function OrderConfirmationPage() {
  const { ulid = "" } = useParams();
  const query = useQuery(orderQuery(ulid));
  const isSlow = useSlowPending(query.isPending);
  const arrival = useArrival();

  if (query.data) {
    return (
      <PageShell {...arrival}>
        <OrderDetails key={query.data.ulid} order={query.data} />
      </PageShell>
    );
  }

  if (isOrderNotFound(query.error)) {
    return (
      <PageShell heading="Order not found" title={ORDER_NOT_FOUND_TITLE}>
        <EmptyState
          title="We could not find this order"
          message="Check the link, or find your games in the store."
          action={<LinkButton to="/">Go to the store</LinkButton>}
        />
      </PageShell>
    );
  }

  if (query.isError) {
    return (
      <PageShell {...arrival}>
        <ErrorState onRetry={() => void query.refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell {...arrival}>
      {isSlow && (
        <Alert role="status">
          Waking up the server. The first visit after a quiet spell can take up
          to a minute.
        </Alert>
      )}
      <OrderPageSkeleton />
    </PageShell>
  );
}

/** Shown when /me fails for a reason other than 401 (network, timeout, 5xx). */
export function OrderErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const message = error instanceof ApiError ? error.message : undefined;

  return (
    <Container className="flex flex-col gap-6 py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">Your order</h1>
      <ErrorState
        message={message}
        onRetry={() => void revalidator.revalidate()}
      />
    </Container>
  );
}
