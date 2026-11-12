import { useRevalidator, useRouteError } from "react-router";
import { ApiError } from "../api/client";
import { Container } from "../components/layout/Container";
import { LinkButton } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";

// Feature 10 replaces this body with the real checkout; the /checkout guard stays.
export function CheckoutPlaceholderPage() {
  return (
    <Container className="flex flex-col items-start gap-4 py-10">
      <title>Checkout | Eneba Marketplace (demo)</title>
      <h1 className="text-2xl font-extrabold md:text-3xl">
        Checkout is coming soon
      </h1>
      <p className="text-fg-soft">Your cart is saved to your account.</p>
      <LinkButton to="/cart" variant="secondary" className="mt-2">
        Back to cart
      </LinkButton>
    </Container>
  );
}

/** Shown when /me fails for a reason other than 401 (network, timeout, 5xx). */
export function CheckoutErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const message = error instanceof ApiError ? error.message : undefined;

  return (
    <Container className="flex flex-col gap-6 py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">Checkout</h1>
      <ErrorState
        message={message}
        onRetry={() => void revalidator.revalidate()}
      />
    </Container>
  );
}
