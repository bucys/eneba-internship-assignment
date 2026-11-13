import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useParams, useRevalidator, useRouteError } from "react-router";
import { ApiError } from "../api/client";
import { orderQuery, type Order } from "../api/orders";
import { Container } from "../components/layout/Container";
import { OrderItemRow } from "../components/orders/OrderItemRow";
import { OrderPageSkeleton } from "../components/orders/OrderPageSkeleton";
import { Price } from "../components/product/Price";
import { Alert } from "../components/ui/Alert";
import { LinkButton } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { useSlowPending } from "../lib/useSlowPending";
import {
  isOrderNotFound,
  ORDER_CONFIRMED_TITLE,
  ORDER_NOT_FOUND_TITLE,
} from "./orderPageView";

const paidAtFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function PageShell({
  heading,
  title = ORDER_CONFIRMED_TITLE,
  children,
}: {
  heading: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <title>{title}</title>
      <h1 className="text-2xl font-extrabold md:text-3xl">{heading}</h1>
      {children}
    </Container>
  );
}

function OrderDetails({ order }: { order: Order }) {
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
      <ul aria-label="Order items" className="flex flex-col gap-2">
        {order.items.map((item, index) => (
          <OrderItemRow key={index} item={item} />
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

export function OrderConfirmationPage() {
  const { ulid = "" } = useParams();
  const query = useQuery(orderQuery(ulid));
  const isSlow = useSlowPending(query.isPending);

  if (query.data) {
    return (
      <PageShell heading="Payment successful">
        <OrderDetails order={query.data} />
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
      <PageShell heading="Payment successful">
        <ErrorState onRetry={() => void query.refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell heading="Payment successful">
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
