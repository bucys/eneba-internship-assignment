import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import {
  useNavigate,
  useRevalidator,
  useRouteError,
  useSearchParams,
} from "react-router";
import { ApiError } from "../api/client";
import { orderListQuery } from "../api/orders";
import { Container } from "../components/layout/Container";
import { OrderListSkeleton } from "../components/orders/OrderListSkeleton";
import { OrderSummaryRow } from "../components/orders/OrderSummaryRow";
import { Alert } from "../components/ui/Alert";
import { LinkButton } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Pagination } from "../components/ui/Pagination";
import {
  orderListErrorMessage,
  ordersPageHref,
  parsePageParam,
} from "../lib/orderHistory";
import { useSlowPending } from "../lib/useSlowPending";
import { ORDERS_TITLE } from "./orderPageView";

/** The page from `?page`; anything that is not a canonical page 2 or above goes to `/orders` (AC-4). */
function useOrdersPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const raw = searchParams.get("page");
  const parsed = parsePageParam(raw);
  const needsCanonicalUrl = raw !== null && (parsed === null || parsed === 1);

  useEffect(() => {
    if (needsCanonicalUrl) void navigate("/orders", { replace: true });
  }, [needsCanonicalUrl, navigate]);

  return parsed ?? 1;
}

/** Scrolls to the top once a different page's rows replace the ones on screen. */
function useScrollTopOnPageChange(shownPage: number | undefined) {
  const lastShown = useRef(shownPage);

  useEffect(() => {
    if (shownPage === undefined) return;
    if (lastShown.current !== undefined && lastShown.current !== shownPage) {
      window.scrollTo({ top: 0 });
    }
    lastShown.current = shownPage;
  }, [shownPage]);
}

function OrdersShell({ children }: { children: ReactNode }) {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <title>{ORDERS_TITLE}</title>
      <h1 className="text-2xl font-extrabold md:text-3xl">My orders</h1>
      {children}
    </Container>
  );
}

export function OrdersPage() {
  const page = useOrdersPage();
  const navigate = useNavigate();
  const query = useQuery(orderListQuery(page));
  const isSlow = useSlowPending(query.isPending);
  const data = query.data;
  const isFresh = data !== undefined && !query.isPlaceholderData;
  const lastPage = data?.meta.last_page ?? 1;
  const isBeyondLast = data !== undefined && data.meta.current_page > lastPage;
  const mustClamp = isFresh && isBeyondLast;

  useEffect(() => {
    if (mustClamp) void navigate(ordersPageHref(lastPage), { replace: true });
  }, [mustClamp, lastPage, navigate]);

  useScrollTopOnPageChange(isFresh && !isBeyondLast ? page : undefined);

  if (data && !isBeyondLast) {
    // While the next page loads, the previous rows stay on screen, so the label and
    // each row's back link follow the page those rows came from, not the URL.
    const shownPage = data.meta.current_page;

    if (data.meta.total === 0) {
      return (
        <OrdersShell>
          <EmptyState
            title="No orders yet"
            message="Keys you buy will appear here."
            action={<LinkButton to="/">Browse games</LinkButton>}
          />
        </OrdersShell>
      );
    }

    return (
      <OrdersShell>
        <ul aria-label="Orders" className="flex flex-col gap-2">
          {data.data.map((order) => (
            <OrderSummaryRow
              key={order.ulid}
              order={order}
              fromPage={shownPage}
            />
          ))}
        </ul>
        <Pagination
          page={shownPage}
          lastPage={lastPage}
          hrefFor={ordersPageHref}
          label="Order pages"
        />
      </OrdersShell>
    );
  }

  if (query.isError) {
    return (
      <OrdersShell>
        <ErrorState
          message={orderListErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      </OrdersShell>
    );
  }

  return (
    <OrdersShell>
      {isSlow && (
        <Alert role="status">
          Waking up the server. The first visit after a quiet spell can take up
          to a minute.
        </Alert>
      )}
      <OrderListSkeleton />
    </OrdersShell>
  );
}

/** Shown when /me fails for a reason other than 401 (network, timeout, 5xx). */
export function OrdersErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const message = error instanceof ApiError ? error.message : undefined;

  return (
    <Container className="flex flex-col gap-6 py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">My orders</h1>
      <ErrorState
        message={message}
        onRetry={() => void revalidator.revalidate()}
      />
    </Container>
  );
}
