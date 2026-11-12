import { useRevalidator, useRouteError } from "react-router";
import { ApiError } from "../api/client";
import { Container } from "../components/layout/Container";
import { ErrorState } from "../components/ui/ErrorState";

// Feature 12 replaces this body with the order history; the /orders guard stays.
export function OrdersPlaceholderPage() {
  return (
    <Container className="py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">My orders</h1>
      <p className="mt-4 text-fg-soft">Your orders will appear here.</p>
    </Container>
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
